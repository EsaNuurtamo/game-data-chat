import {
  DATASET_VERSION,
  DEFAULT_DATASET_TTL_MS,
  buildDatasetKey,
  buildPageKey,
  kvDatasetRecordSchema,
  shouldRefresh,
} from "@game-data/db";
import type {
  CanonicalizedFilters,
  GameSummary,
  KvDatasetRecord,
} from "@game-data/db";
import { z } from "zod";

import { CACHE_TTL_SECONDS, RAWG_API_BASE } from "./constants";
import type { EnvBindings } from "./types";
import { safeReadError } from "./utils";
import { resolveParentPlatformIds, resolvePlatformIds } from "./platforms";

const rawgResponseSchema = z.object({
  count: z.number().optional(),
  results: kvDatasetRecordSchema.shape.items,
});

export async function handleFetchDataset(
  env: EnvBindings,
  datasetKey: string,
  canonicalFilters: CanonicalizedFilters
): Promise<KvDatasetRecord> {
  const raw = await fetchRawgDataset(env, datasetKey, canonicalFilters);
  const record: KvDatasetRecord = {
    ...raw,
    version: DATASET_VERSION,
  };

  await writeDataset(
    env.RAWG_CACHE,
    buildPageKey(datasetKey, canonicalFilters.page),
    record
  );

  return record;
}

export async function buildAggregateDataset(
  env: EnvBindings,
  dataset: KvDatasetRecord
): Promise<KvDatasetRecord> {
  const pages: KvDatasetRecord[] = [];
  const baseFilters = duplicateFilters(dataset.filters);

  console.log(
    "[mcp] aggregate_dataset_start",
    JSON.stringify({
      datasetKey: dataset.key,
      totalPages: dataset.totalPages,
      cachedPage: dataset.page,
    })
  );

  for (let page = 1; page <= dataset.totalPages; page += 1) {
    if (page === dataset.page) {
      pages.push(dataset);
      continue;
    }

    const pageDataset = await loadDatasetPage(env, baseFilters, page);
    pages.push(pageDataset);

     if (pageDataset.key !== dataset.key || page !== dataset.page) {
       console.log(
         "[mcp] aggregate_dataset_page",
         JSON.stringify({
           datasetKey: dataset.key,
           pageFetched: pageDataset.page,
           totalPages: dataset.totalPages,
           items: pageDataset.items.length,
         })
       );
     }
  }

  pages.sort((a, b) => a.page - b.page);

  const freshest = pages.reduce((latest, current) => {
    return new Date(current.fetchedAt) > new Date(latest.fetchedAt)
      ? current
      : latest;
  }, dataset);

  const dedupedItems = dedupeItems(pages.flatMap((entry) => entry.items));

  console.log(
    "[mcp] aggregate_dataset_complete",
    JSON.stringify({
      datasetKey: dataset.key,
      pagesAggregated: pages.length,
      totalItems: dedupedItems.length,
    })
  );

  return {
    ...dataset,
    page: dataset.page,
    totalPages: pages.length,
    fetchedAt: freshest.fetchedAt,
    expiresAt: freshest.expiresAt,
    items: dedupedItems,
  };
}

export async function loadDatasetPage(
  env: EnvBindings,
  baseFilters: CanonicalizedFilters,
  page: number
): Promise<KvDatasetRecord> {
  const filtersForPage: CanonicalizedFilters = {
    genres: [...baseFilters.genres],
    platforms: [...baseFilters.platforms],
    parentPlatforms: [...baseFilters.parentPlatforms],
    tags: [...baseFilters.tags],
    releasedFrom: baseFilters.releasedFrom,
    releasedTo: baseFilters.releasedTo,
    page,
    pageSize: baseFilters.pageSize,
  };

  const { key, canonical } = await buildDatasetKey(filtersForPage);
  const pageKey = buildPageKey(key, canonical.page);

  let dataset = await readDataset(env.RAWG_CACHE, pageKey);
  const cacheHit = Boolean(dataset);
  const needsRefresh = !dataset || shouldRefresh(dataset);
  if (needsRefresh) {
    dataset = await handleFetchDataset(env, key, canonical);
  }

  if (!dataset) {
    throw new Error(`Failed to hydrate dataset page ${page}`);
  }

  console.log(
    "[mcp] dataset_page_resolved",
    JSON.stringify({
      datasetKey: key,
      page,
      cacheHit,
      refreshed: needsRefresh,
      items: dataset.items.length,
    })
  );

  return dataset;
}

export async function readDataset(
  kv: EnvBindings["RAWG_CACHE"],
  key: string
): Promise<KvDatasetRecord | null> {
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

export async function writeDataset(
  kv: EnvBindings["RAWG_CACHE"],
  key: string,
  record: KvDatasetRecord
): Promise<void> {
  await kv.put(key, JSON.stringify(record), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
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

export function dedupeItems(items: GameSummary[]): GameSummary[] {
  const seen = new Map<number, GameSummary>();
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

async function fetchRawgDataset(
  env: EnvBindings,
  datasetKey: string,
  canonicalFilters: CanonicalizedFilters
) {
  if (!env.RAWG_API_KEY) {
    throw new Error("RAWG_API_KEY is not configured");
  }

  const url = new URL(RAWG_API_BASE);
  url.searchParams.set("key", env.RAWG_API_KEY);
  url.searchParams.set("page", String(canonicalFilters.page));
  url.searchParams.set("page_size", String(canonicalFilters.pageSize));

  if (canonicalFilters.genres.length > 0) {
    url.searchParams.set("genres", canonicalFilters.genres.join(","));
  }

  if (canonicalFilters.platforms.length > 0) {
    const platformIds = await resolvePlatformIds(
      canonicalFilters.platforms,
      env
    );
    url.searchParams.set("platforms", platformIds.join(","));
  }

  if (canonicalFilters.parentPlatforms.length > 0) {
    const parentPlatformIds = resolveParentPlatformIds(
      canonicalFilters.parentPlatforms
    );
    url.searchParams.set("parent_platforms", parentPlatformIds.join(","));
  }

  if (canonicalFilters.tags.length > 0) {
    url.searchParams.set("tags", canonicalFilters.tags.join(","));
  }

  if (canonicalFilters.releasedFrom || canonicalFilters.releasedTo) {
    const from = canonicalFilters.releasedFrom ?? "1900-01-01";
    const to =
      canonicalFilters.releasedTo ?? new Date().toISOString().slice(0, 10);
    url.searchParams.set("dates", `${from},${to}`);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
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
        rating: (item as { rating?: unknown }).rating ?? null,
      })),
    })
  );
  const pageSize = canonicalFilters.pageSize;
  const totalPages =
    typeof count === "number" && count > 0
      ? Math.ceil(count / pageSize)
      : canonicalFilters.page;
  const now = new Date();

  return {
    key: datasetKey,
    filters: canonicalFilters,
    page: canonicalFilters.page,
    totalPages: Math.max(totalPages, canonicalFilters.page),
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + DEFAULT_DATASET_TTL_MS).toISOString(),
    items,
  } satisfies Omit<KvDatasetRecord, "version">;
}
