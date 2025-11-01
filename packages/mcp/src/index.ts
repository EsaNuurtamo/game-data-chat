import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DATASET_VERSION,
  DEFAULT_DATASET_TTL_MS,
  buildDatasetKey,
  buildPageKey,
  calculate,
  fetchFiltersSchema,
  gameSummarySchema as sharedGameSummarySchema,
  kvDatasetRecordSchema,
  normalizeFilterValue,
  shouldRefresh
} from "@game-data/db";
import type { CanonicalizedFilters, KvDatasetRecord, GameSummary } from "@game-data/db";
import type { DurableObjectNamespace, ExecutionContext, KVNamespace } from "@cloudflare/workers-types";
import { z } from "zod";

const VERSION = "0.5.0";
const RAWG_API_BASE = "https://api.rawg.io/api/games";
const RAWG_PLATFORMS_BASE = "https://api.rawg.io/api/platforms";
const CACHE_TTL_SECONDS = Math.floor(DEFAULT_DATASET_TTL_MS / 1000);
const PLATFORM_CACHE_VERSION = "v1";
const PLATFORM_CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours
const PLATFORM_DIRECTORY_KEY = `rawg:platforms:${PLATFORM_CACHE_VERSION}`;

const PLATFORM_SLUG_TO_ID: Record<string, string> = {
  "pc": "4",
  "playstation-5": "187",
  "playstation-4": "18",
  "playstation-3": "16",
  "playstation-2": "15",
  "playstation": "27",
  "xbox-one": "1",
  "xbox-series-x": "186",
  "xbox-360": "14",
  "xbox": "80",
  "nintendo-switch": "7",
  "nintendo-3ds": "8",
  "nintendo-ds": "9",
  "nintendo-wii": "11",
  "nintendo-wii-u": "10",
  "ios": "3",
  "android": "21",
  "macos": "5",
  "linux": "6"
};

const fetchToolArgsShape = {
  filters: fetchFiltersSchema,
  force: z.boolean().optional()
} as const;

const fetchInputSchema = z.object(fetchToolArgsShape);

const filtersOutputSchema = z.object({
  genres: z.array(z.string()),
  platforms: z.array(z.string()),
  releasedFrom: z.string().nullable().optional(),
  releasedTo: z.string().nullable().optional(),
  page: z.number(),
  pageSize: z.number()
});

const fetchOutputSchema = z.object({
  datasetId: z.string(),
  datasetKey: z.string(),
  cacheStatus: z.enum(["hit", "miss", "refresh"]),
  totalPages: z.number(),
  totalItems: z.number(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  filters: filtersOutputSchema
});

const executeToolArgsShape = {
  datasetId: z.string(),
  operation: z.enum(["avg", "count", "group_avg"]),
  field: z.enum(["metacritic", "rating"]),
  groupBy: z.enum(["genres", "platforms"]).optional(),
  fresh: z.boolean().optional()
} as const;

const executeInputSchema = z.object(executeToolArgsShape);

const executeOutputSchema = z.object({
  datasetId: z.string(),
  operation: z.enum(["avg", "count", "group_avg"]),
  field: z.enum(["metacritic", "rating"]),
  groupBy: z.string().nullable(),
  value: z.unknown(),
  itemsProcessed: z.number(),
  fetchedAt: z.string(),
  expiresAt: z.string()
});

type FetchInput = z.infer<typeof fetchInputSchema>;
type FetchOutput = z.infer<typeof fetchOutputSchema>;
type ExecuteInput = z.infer<typeof executeInputSchema>;
type ExecuteOutput = z.infer<typeof executeOutputSchema>;

type EnvBindings = {
  RAWG_API_KEY: string;
  RAWG_CACHE: KVNamespace;
};

type WorkerEnv = EnvBindings & {
  MCP_OBJECT: DurableObjectNamespace;
};

type PlatformDirectoryRecord = {
  version: string;
  fetchedAt: string;
  expiresAt: string;
  platforms: PlatformSummary[];
};

type PlatformSummary = {
  id: number;
  slug: string;
  name: string;
};

const rawgPlatformSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string()
});

const rawgPlatformResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(rawgPlatformSchema)
});

const platformDirectoryRecordSchema = z.object({
  version: z.string(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  platforms: z.array(rawgPlatformSchema)
});

export class GameDataAgent extends McpAgent<EnvBindings> {
  server = new McpServer({
    name: "game-data-chat-mcp",
    version: VERSION
  });

  private get bindings(): EnvBindings {
    return (this as unknown as { env: EnvBindings }).env;
  }

  async init(): Promise<void> {
    this.server.tool(
      "fetch_game_data",
      "Retrieve RAWG game metadata with optional filters. Responses are cached in Cloudflare KV.",
      fetchToolArgsShape,
      async ({ filters, force }) => {
        const result = await handleFetchGameData(
          { filters, force: force ?? false },
          this.bindings
        );

        return {
          content: [
            {
              type: "text",
              text: [
                `datasetId=${result.datasetId}`,
                `cache=${result.cacheStatus}`,
                `pages=${result.totalPages}`,
                `items=${result.totalItems}`
              ].join(" | ")
            }
          ],
          structuredContent: fetchOutputSchema.parse(result)
        };
      }
    );

    this.server.tool(
      "execute_calculation",
      "Run numerical aggregations against a cached RAWG dataset.",
      executeToolArgsShape,
      async ({ datasetId, operation, field, groupBy, fresh }) => {
        const result = await handleExecuteCalculation(
          { datasetId, operation, field, groupBy, fresh: fresh ?? false },
          this.bindings
        );

        return {
          content: [
            {
              type: "text",
              text: [
                `datasetId=${result.datasetId}`,
                `operation=${result.operation}`,
                `itemsProcessed=${result.itemsProcessed}`,
                `value=${JSON.stringify(result.value)}`
              ].join(" | ")
            }
          ],
          structuredContent: executeOutputSchema.parse(result)
        };
      }
    );
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return GameDataAgent.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return GameDataAgent.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          service: "game-data-chat-mcp",
          version: VERSION,
          datasetVersion: DATASET_VERSION
        }),
        {
          headers: { "content-type": "application/json" }
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function handleFetchGameData(input: FetchInput, env: EnvBindings): Promise<FetchOutput> {
  const parsed = fetchInputSchema.parse(input);
  const { key: datasetKey, canonical } = await buildDatasetKey(parsed.filters);
  const pageKey = buildPageKey(datasetKey, canonical.page);

  let dataset = await readDataset(env.RAWG_CACHE, pageKey);
  let cacheStatus: FetchOutput["cacheStatus"] = dataset ? "hit" : "miss";

  if (!dataset || parsed.force || shouldRefresh(dataset)) {
    dataset = await fetchAndCacheDataset(env, datasetKey, canonical);
    cacheStatus = dataset
      ? cacheStatus === "hit"
        ? "refresh"
        : "miss"
      : cacheStatus;
  }

  if (!dataset) {
    throw new Error("Failed to retrieve dataset from RAWG cache");
  }

  const aggregate = await buildAggregateDataset(env, dataset);
  await writeDataset(env.RAWG_CACHE, datasetKey, aggregate);

  console.log(
    "[mcp] fetch_game_data",
    JSON.stringify({
      datasetKey,
      pagesFetched: aggregate.totalPages,
      totalItems: aggregate.items.length,
      cacheStatus
    })
  );

  return fetchOutputSchema.parse({
    datasetId: datasetKey,
    datasetKey,
    cacheStatus,
    totalPages: aggregate.totalPages,
    totalItems: aggregate.items.length,
    fetchedAt: aggregate.fetchedAt,
    expiresAt: aggregate.expiresAt,
    filters: aggregate.filters
  });
}

async function handleExecuteCalculation(
  input: ExecuteInput,
  env: EnvBindings
): Promise<ExecuteOutput> {
  const parsed = executeInputSchema.parse(input);
  const dataset = await readDataset(env.RAWG_CACHE, parsed.datasetId);

  if (!dataset) {
    throw new Error(
      `Dataset ${parsed.datasetId} not found in cache. Fetch it using fetch_game_data before running calculations.`
    );
  }

  const latestDataset =
    parsed.fresh || shouldRefresh(dataset)
      ? await fetchAndCacheDataset(env, dataset.key, dataset.filters)
      : dataset;

  const aggregateDataset = await buildAggregateDataset(env, latestDataset);
  await writeDataset(env.RAWG_CACHE, aggregateDataset.key, aggregateDataset);

  const calcResult = calculate({
    dataset: aggregateDataset,
    operation: parsed.operation,
    field: parsed.field,
    groupBy: parsed.groupBy
  });

  console.log(
    "[mcp] execute_calculation",
    JSON.stringify({
      datasetId: parsed.datasetId,
      operation: parsed.operation,
      groupBy: parsed.groupBy ?? null,
      itemsProcessed: calcResult.itemsProcessed,
      totalItems: aggregateDataset.items.length
    })
  );

  return executeOutputSchema.parse({
    datasetId: parsed.datasetId,
    operation: parsed.operation,
    field: parsed.field,
    groupBy: parsed.groupBy ?? null,
    value: calcResult.value ?? null,
    itemsProcessed: calcResult.itemsProcessed,
    fetchedAt: aggregateDataset.fetchedAt,
    expiresAt: aggregateDataset.expiresAt
  });
}

async function buildAggregateDataset(
  env: EnvBindings,
  dataset: KvDatasetRecord
): Promise<KvDatasetRecord> {
  const pages: KvDatasetRecord[] = [];
  const baseFilters = duplicateFilters(dataset.filters);

  for (let page = 1; page <= dataset.totalPages; page += 1) {
    if (page === dataset.page) {
      pages.push(dataset);
      continue;
    }

    const pageDataset = await loadDatasetPage(env, baseFilters, page);
    pages.push(pageDataset);
  }

  pages.sort((a, b) => a.page - b.page);

  const combinedItems = pages.flatMap((entry) => entry.items);
  const freshest = pages.reduce((latest, current) => {
    return new Date(current.fetchedAt) > new Date(latest.fetchedAt) ? current : latest;
  }, dataset);

  const dedupedItems = dedupeItems(pages.flatMap((entry) => entry.items));

  return {
    ...dataset,
    page: dataset.page,
    totalPages: pages.length,
    fetchedAt: freshest.fetchedAt,
    expiresAt: freshest.expiresAt,
    items: dedupedItems
  };
}

async function loadDatasetPage(
  env: EnvBindings,
  baseFilters: CanonicalizedFilters,
  page: number
): Promise<KvDatasetRecord> {
  const filtersForPage: CanonicalizedFilters = {
    genres: [...baseFilters.genres],
    platforms: [...baseFilters.platforms],
    releasedFrom: baseFilters.releasedFrom,
    releasedTo: baseFilters.releasedTo,
    page,
    pageSize: baseFilters.pageSize
  };

  const { key, canonical } = await buildDatasetKey(filtersForPage);
  const pageKey = buildPageKey(key, canonical.page);

  let dataset = await readDataset(env.RAWG_CACHE, pageKey);
  if (!dataset || shouldRefresh(dataset)) {
    dataset = await fetchAndCacheDataset(env, key, canonical);
  }

  if (!dataset) {
    throw new Error(`Failed to hydrate dataset page ${page}`);
  }

  return dataset;
}

function duplicateFilters(filters: CanonicalizedFilters): CanonicalizedFilters {
  return {
    genres: [...filters.genres],
    platforms: [...filters.platforms],
    releasedFrom: filters.releasedFrom,
    releasedTo: filters.releasedTo,
    page: filters.page,
    pageSize: filters.pageSize
  };
}

function dedupeItems(items: GameSummary[]): GameSummary[] {
  const seen = new Map<number, GameSummary>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

async function readDataset(kv: KVNamespace, key: string): Promise<KvDatasetRecord | null> {
  const stored = await kv.get(key, { type: "json" });
  if (!stored) {
    return null;
  }
  const parsed = kvDatasetRecordSchema.safeParse(stored);
  if (!parsed.success || parsed.data.version !== DATASET_VERSION) {
    await kv.delete(key);
    return null;
  }
  return parsed.data;
}

async function writeDataset(
  kv: KVNamespace,
  key: string,
  record: KvDatasetRecord
): Promise<void> {
  await kv.put(key, JSON.stringify(record), {
    expirationTtl: CACHE_TTL_SECONDS
  });
}

async function fetchAndCacheDataset(
  env: EnvBindings,
  datasetKey: string,
  canonicalFilters: CanonicalizedFilters
): Promise<KvDatasetRecord> {
  const raw = await fetchRawgDataset(env, datasetKey, canonicalFilters);
  const record: KvDatasetRecord = {
    ...raw,
    version: DATASET_VERSION
  };

  await writeDataset(env.RAWG_CACHE, buildPageKey(datasetKey, canonicalFilters.page), record);

  return record;
}

async function fetchRawgDataset(
  env: EnvBindings,
  datasetKey: string,
  canonicalFilters: CanonicalizedFilters
) {
  if (!env.RAWG_API_KEY) {
    throw new Error("RAWG_API_KEY is not configured");
  }

  const platformIds = await resolvePlatformIds(canonicalFilters.platforms, env);

  const url = new URL(RAWG_API_BASE);
  url.searchParams.set("key", env.RAWG_API_KEY);
  url.searchParams.set("page", String(canonicalFilters.page));
  url.searchParams.set("page_size", String(canonicalFilters.pageSize));

  if (canonicalFilters.genres.length > 0) {
    url.searchParams.set("genres", canonicalFilters.genres.join(","));
  }

  if (platformIds.length > 0) {
    url.searchParams.set("platforms", platformIds.join(","));
  }

  if (canonicalFilters.releasedFrom || canonicalFilters.releasedTo) {
    const from = canonicalFilters.releasedFrom ?? "1900-01-01";
    const to = canonicalFilters.releasedTo ?? new Date().toISOString().slice(0, 10);
    url.searchParams.set("dates", `${from},${to}`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(`RAWG request failed (${response.status}): ${message}`);
  }

  const data: unknown = await response.json();
  const parsed = rawgResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Failed to parse RAWG response: ${parsed.error.message}`);
  }

  const { count, results: items } = parsed.data;
  const sanitizedUrl = url.toString().replace(env.RAWG_API_KEY, "***");
  console.log(
    "[mcp] rawg_response",
    JSON.stringify({
      datasetKey,
      request: sanitizedUrl,
      count,
      items: items.length,
      sample: items.slice(0, 5).map((item) => ({
        id: item.id,
        name: item.name,
        metacritic: (item as { metacritic?: unknown }).metacritic ?? null,
        rating: (item as { rating?: unknown }).rating ?? null
      }))
    })
  );
  const pageSize = canonicalFilters.pageSize;
  const totalPages =
    typeof count === "number" && count > 0 ? Math.ceil(count / pageSize) : canonicalFilters.page;
  const now = new Date();

  return {
    key: datasetKey,
    filters: canonicalFilters,
    page: canonicalFilters.page,
    totalPages: Math.max(totalPages, canonicalFilters.page),
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEFAULT_DATASET_TTL_MS).toISOString(),
    items
  } satisfies Omit<KvDatasetRecord, "version">;
}

async function safeReadError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 500);
  } catch {
    return "Unknown error";
  }
}

const rawgResponseSchema = z.object({
  count: z.number().optional(),
  results: kvDatasetRecordSchema.shape.items
});

async function getPlatformDirectory(env: EnvBindings): Promise<PlatformDirectoryRecord> {
  const cached = await env.RAWG_CACHE.get(PLATFORM_DIRECTORY_KEY, { type: "json" });
  if (cached) {
    const parsed = platformDirectoryRecordSchema.safeParse(cached);
    if (parsed.success) {
      if (parsed.data.version === PLATFORM_CACHE_VERSION && !shouldRefreshDirectory(parsed.data)) {
        return parsed.data;
      }
    }
  }

  const record = await fetchPlatformDirectory(env);
  await env.RAWG_CACHE.put(PLATFORM_DIRECTORY_KEY, JSON.stringify(record), {
    expirationTtl: PLATFORM_CACHE_TTL_SECONDS
  });
  return record;
}

function shouldRefreshDirectory(record: PlatformDirectoryRecord, now: Date = new Date()): boolean {
  return new Date(record.expiresAt).getTime() <= now.getTime();
}

async function fetchPlatformDirectory(env: EnvBindings): Promise<PlatformDirectoryRecord> {
  if (!env.RAWG_API_KEY) {
    throw new Error("RAWG_API_KEY is not configured");
  }

  const platforms: PlatformSummary[] = [];
  let nextUrl: string | null = buildPlatformsUrl(env.RAWG_API_KEY, 1);

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      const message = await safeReadError(response);
      throw new Error(`RAWG platforms request failed (${response.status}): ${message}`);
    }
    const json: unknown = await response.json();
    const parsed = rawgPlatformResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Failed to parse RAWG platforms response: ${parsed.error.message}`);
    }

    platforms.push(...parsed.data.results);

    if (!parsed.data.next) {
      nextUrl = null;
    } else {
      const next = new URL(parsed.data.next);
      if (!next.searchParams.has("key")) {
        next.searchParams.set("key", env.RAWG_API_KEY);
      }
      if (!next.searchParams.has("page_size")) {
        next.searchParams.set("page_size", "40");
      }
      nextUrl = next.toString();
    }
  }

  const now = new Date();
  return {
    version: PLATFORM_CACHE_VERSION,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PLATFORM_CACHE_TTL_SECONDS * 1000).toISOString(),
    platforms
  };
}

function buildPlatformsUrl(apiKey: string, page: number): string {
  const url = new URL(RAWG_PLATFORMS_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "40");
  return url.toString();
}

async function resolvePlatformIds(
  platformFilters: string[],
  env: EnvBindings
): Promise<string[]> {
  if (platformFilters.length === 0) {
    return [];
  }

  const directory = await getPlatformDirectory(env);
  const slugMap = new Map<string, string>();

  for (const platform of directory.platforms) {
    const id = String(platform.id);
    const normalizedSlug = normalizeFilterValue(platform.slug);
    const normalizedName = normalizeFilterValue(platform.name);
    slugMap.set(normalizedSlug, id);
    slugMap.set(platform.slug.toLowerCase(), id);
    slugMap.set(normalizedName, id);
  }

  const resolved = new Set<string>();

  for (const value of platformFilters) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (/^\d+$/.test(trimmed)) {
      resolved.add(trimmed);
      continue;
    }
    const normalized = normalizeFilterValue(trimmed);
    const lower = trimmed.toLowerCase();
    const resolvedId = slugMap.get(normalized) ?? slugMap.get(lower);
    if (resolvedId) {
      resolved.add(resolvedId);
    } else {
      console.warn(
        "[mcp] unresolved_platform",
        JSON.stringify({
          input: trimmed
        })
      );
    }
  }

  return Array.from(resolved);
}
