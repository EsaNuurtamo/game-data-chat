import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 40;
export const DATASET_VERSION = "v1";
export const DATASET_NAMESPACE_PREFIX = `rawg:games:${DATASET_VERSION}`;
export const DEFAULT_DATASET_TTL_MS = 1000 * 60 * 60; // 1 hour

/**
 * RAWG game summary subset used across the stack.
 */
export const gameSummarySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  released: z.string().nullable(),
  metacritic: z.number().nullable(),
  genres: z
    .array(
      z.object({
        id: z.number(),
        slug: z.string(),
        name: z.string(),
      })
    )
    .nullish()
    .transform((genres) => genres ?? []),
  platforms: z
    .array(
      z.object({
        platform: z.object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
        }),
      })
    )
    .nullish()
    .transform((platforms) => platforms ?? []),
  rating: z.number().nullable(),
});

export type GameSummary = z.infer<typeof gameSummarySchema>;

export const fetchFiltersSchema = z.object({
  genres: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  parentPlatforms: z.array(z.string()).optional(),
  releasedFrom: z.string().optional(),
  releasedTo: z.string().optional(),
  page: z.number().min(1).max(40).optional(),
  pageSize: z.number().min(1).max(DEFAULT_PAGE_SIZE).optional(),
});

export type FetchFilters = z.infer<typeof fetchFiltersSchema>;

export interface CanonicalizedFilters {
  genres: string[];
  platforms: string[];
  releasedFrom?: string;
  releasedTo?: string;
  page: number;
  pageSize: number;
}

export const datasetMetadataSchema = z.object({
  key: z.string(),
  filters: z.object({
    genres: z.array(z.string()),
    platforms: z.array(z.string()),
    releasedFrom: z.string().optional(),
    releasedTo: z.string().optional(),
    page: z.number(),
    pageSize: z.number(),
  }),
  page: z.number(),
  totalPages: z.number(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  items: z.array(gameSummarySchema),
});

export type DatasetMetadata = z.infer<typeof datasetMetadataSchema>;

export const CALCULATION_OPERATIONS = ["avg", "count", "group_avg"] as const;

export type CalculationOperation = (typeof CALCULATION_OPERATIONS)[number];

export interface ExecuteCalculationInput {
  dataset: DatasetMetadata;
  operation: CalculationOperation;
  field: keyof Pick<GameSummary, "metacritic" | "rating">;
  groupBy?: "genres" | "platforms";
}

export interface ExecuteCalculationResult<TValue = unknown> {
  itemsProcessed: number;
  value: TValue;
}

export interface KvDatasetRecord extends DatasetMetadata {
  version: string;
}

export const kvDatasetRecordSchema = datasetMetadataSchema.extend({
  version: z.string(),
});

const textEncoder = new TextEncoder();

export function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

async function sha256Hex(input: string): Promise<string> {
  if (
    typeof globalThis.crypto === "undefined" ||
    !("subtle" in globalThis.crypto) ||
    typeof globalThis.crypto.subtle.digest !== "function"
  ) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const encoded = textEncoder.encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function expandFilterValues(values?: string[]): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  const expanded: string[] = [];
  for (const value of values) {
    const chunks = value
      .split(",")
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
    expanded.push(...chunks);
  }
  return expanded;
}

export function canonicalizeFilters(
  filters: FetchFilters
): CanonicalizedFilters {
  const genres = expandFilterValues(filters.genres)
    .map(normalizeFilterValue)
    .sort();
  const platforms = expandFilterValues(filters.platforms)
    .map(normalizeFilterValue)
    .sort();

  return {
    genres,
    platforms,
    releasedFrom: filters.releasedFrom,
    releasedTo: filters.releasedTo,
    page: filters.page ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export async function buildDatasetKey(filters: FetchFilters): Promise<{
  key: string;
  canonical: CanonicalizedFilters;
  hash: string;
}> {
  const canonical = canonicalizeFilters(filters);
  const json = JSON.stringify(canonical);
  const hash = await sha256Hex(json);
  const key = `${DATASET_NAMESPACE_PREFIX}:${hash}`;
  return { key, canonical, hash };
}

export function buildPageKey(datasetKey: string, page: number): string {
  return `${datasetKey}:p${page}`;
}

export function shouldRefresh(
  dataset: DatasetMetadata,
  now: Date = new Date()
): boolean {
  return new Date(dataset.expiresAt).getTime() <= now.getTime();
}

export function calculate({
  dataset,
  operation,
  field,
  groupBy,
}: ExecuteCalculationInput): ExecuteCalculationResult {
  const items = dataset.items;
  if (items.length === 0) {
    return { itemsProcessed: 0, value: operation === "count" ? 0 : null };
  }

  switch (operation) {
    case "count": {
      return { itemsProcessed: items.length, value: items.length };
    }
    case "avg": {
      const numeric = items
        .map((item) => (item[field] == null ? null : Number(item[field])))
        .filter((value): value is number => {
          if (typeof value !== "number" || Number.isNaN(value)) {
            return false;
          }
          if (field === "rating") {
            return value > 0;
          }
          return true;
        });
      if (numeric.length === 0) {
        return { itemsProcessed: items.length, value: null };
      }
      const sum = numeric.reduce((acc, value) => acc + value, 0);
      return {
        itemsProcessed: items.length,
        value: sum / numeric.length,
      };
    }
    case "group_avg": {
      if (!groupBy) {
        throw new Error("groupBy is required for group_avg operation");
      }

      type Bucket = { sum: number; count: number };
      const buckets = new Map<string, Bucket>();

      for (const item of items) {
        const measurement = item[field];
        if (measurement == null || Number.isNaN(Number(measurement))) {
          continue;
        }
        const targets =
          groupBy === "genres"
            ? item.genres.map((genre) => genre.name)
            : item.platforms.map((entry) => entry.platform.name);

        for (const target of targets) {
          const bucket = buckets.get(target) ?? { sum: 0, count: 0 };
          const numeric = Number(measurement);
          if (Number.isNaN(numeric)) {
            continue;
          }
          if (field === "rating" && numeric <= 0) {
            continue;
          }
          bucket.sum += numeric;
          bucket.count += 1;
          buckets.set(target, bucket);
        }
      }

      const averages = Array.from(buckets.entries()).map(([label, bucket]) => ({
        label,
        average: bucket.count > 0 ? bucket.sum / bucket.count : null,
        count: bucket.count,
      }));

      return { itemsProcessed: items.length, value: averages };
    }
    default: {
      const exhaustiveCheck: never = operation;
      throw new Error(`Unsupported operation: ${exhaustiveCheck}`);
    }
  }
}
