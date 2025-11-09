import { z } from "zod";

import {
  DATASET_NAMESPACE_PREFIX,
  DEFAULT_DATASET_TTL_MS,
} from "./constants";
import {
  CanonicalizedFilters,
  FetchFilters,
  canonicalizeFilters,
} from "./filters";
import { gameSummarySchema } from "./schemas";

export const datasetMetadataSchema = z.object({
  key: z.string(),
  filters: z.object({
    genres: z.array(z.string()),
    platforms: z.array(z.string()),
    parentPlatforms: z.array(z.string()),
    tags: z.array(z.string()),
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

export interface KvDatasetRecord extends DatasetMetadata {
  version: string;
}

export const kvDatasetRecordSchema = datasetMetadataSchema.extend({
  version: z.string(),
});

const textEncoder = new TextEncoder();

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

export async function buildDatasetKey(
  filters: FetchFilters
): Promise<{
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

export function shouldRefresh(
  dataset: DatasetMetadata,
  now: Date = new Date()
): boolean {
  return new Date(dataset.expiresAt).getTime() <= now.getTime();
}

export function duplicateFilters(
  filters: CanonicalizedFilters
): CanonicalizedFilters {
  return {
    genres: [...filters.genres],
    platforms: [...filters.platforms],
    parentPlatforms: [...filters.parentPlatforms],
    tags: [...filters.tags],
    releasedFrom: filters.releasedFrom,
    releasedTo: filters.releasedTo,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function setDatasetExpiry(now: Date = new Date()): {
  fetchedAt: string;
  expiresAt: string;
} {
  return {
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEFAULT_DATASET_TTL_MS).toISOString(),
  };
}
