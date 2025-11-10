import {
  DATASET_VERSION,
  DEFAULT_DATASET_TTL_MS,
  duplicateFilters,
  kvDatasetRecordSchema,
} from "@game-data/db";
import type {
  CanonicalizedFilters,
  GameSummary,
  KvDatasetRecord,
} from "@game-data/db";
import { z } from "zod";

import { RAWG_API_BASE, RAWG_RESULT_HARD_LIMIT } from "../helpers/constants";
import type { EnvBindings } from "../env";
import { safeReadError } from "../helpers/utils";
import { resolveParentPlatformIds, resolvePlatformIds } from "./platforms";

const rawgResponseSchema = z.object({
  count: z.number().optional(),
  results: kvDatasetRecordSchema.shape.items,
});

export async function fetchAggregateDataset(
  env: EnvBindings,
  datasetKey: string,
  canonicalFilters: CanonicalizedFilters
): Promise<KvDatasetRecord> {
  const pages: Array<Omit<KvDatasetRecord, "version">> = [];
  const baseFilters = duplicateFilters(canonicalFilters);

  console.log(
    "[mcp] aggregate_dataset_start",
    JSON.stringify({
      datasetKey,
      requestedPage: canonicalFilters.page,
      pageSize: canonicalFilters.pageSize,
    })
  );

  let totalPages = 0;
  for (let page = 1; totalPages === 0 || page <= totalPages; page += 1) {
    baseFilters.page = page;
    const pageDataset = await fetchRawgDataset(env, datasetKey, baseFilters);
    pages.push(pageDataset);
    totalPages = Math.max(totalPages, pageDataset.totalPages);

    console.log(
      "[mcp] aggregate_dataset_page",
      JSON.stringify({
        datasetKey,
        pageFetched: page,
        totalPages: pageDataset.totalPages,
        items: pageDataset.items.length,
      })
    );
  }

  pages.sort((a, b) => a.page - b.page);

  const freshest = pages.reduce((latest, current) => {
    return new Date(current.fetchedAt) > new Date(latest.fetchedAt)
      ? current
      : latest;
  }, pages[0]);

  const dedupedItems = dedupeItems(pages.flatMap((entry) => entry.items));

  console.log(
    "[mcp] aggregate_dataset_complete",
    JSON.stringify({
      datasetKey,
      pagesAggregated: pages.length,
      totalItems: dedupedItems.length,
    })
  );

  return {
    key: datasetKey,
    filters: canonicalFilters,
    page: canonicalFilters.page,
    totalPages: Math.max(totalPages, canonicalFilters.page),
    fetchedAt: freshest.fetchedAt,
    expiresAt: freshest.expiresAt,
    items: dedupedItems,
    version: DATASET_VERSION,
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

  const sanitizedUrl = url.toString().replace(env.RAWG_API_KEY, "***");
  const { count, results: items } = parsed.data;

  if (typeof count === "number" && count > RAWG_RESULT_HARD_LIMIT) {
    console.warn(
      "[mcp] rawg_response_limit_exceeded",
      JSON.stringify({
        datasetKey,
        request: sanitizedUrl,
        count,
        limit: RAWG_RESULT_HARD_LIMIT,
      })
    );
    throw new Error(
      [
        `RAWG returned ${count} games, which exceeds the maximum allowed (${RAWG_RESULT_HARD_LIMIT}).`,
        "Please add filters (genre, platform, release window, tags) to narrow your request below this limit and try again.",
      ].join(" ")
    );
  }

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
