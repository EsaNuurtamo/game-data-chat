import { buildDatasetKey, buildPageKey, fetchFiltersSchema, shouldRefresh } from "@game-data/db";
import { z } from "zod";

import { buildAggregateDataset, handleFetchDataset, readDataset, writeDataset } from "../datasets";
import type { EnvBindings } from "../types";

export const fetchToolArgsShape = {
  filters: fetchFiltersSchema,
  force: z.boolean().optional()
} as const;

const fetchInputSchema = z.object(fetchToolArgsShape);

const filtersOutputSchema = z.object({
  genres: z.array(z.string()),
  platforms: z.array(z.string()),
  parentPlatforms: z.array(z.string()),
  tags: z.array(z.string()),
  releasedFrom: z.string().nullable().optional(),
  releasedTo: z.string().nullable().optional(),
  page: z.number(),
  pageSize: z.number()
});

export const fetchOutputSchema = z.object({
  datasetId: z.string(),
  datasetKey: z.string(),
  cacheStatus: z.enum(["hit", "miss", "refresh"]),
  totalPages: z.number(),
  totalItems: z.number(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  filters: filtersOutputSchema
});

export type FetchInput = z.infer<typeof fetchInputSchema>;
export type FetchOutput = z.infer<typeof fetchOutputSchema>;

export async function handleFetchGameData(
  input: FetchInput,
  env: EnvBindings
): Promise<FetchOutput> {
  const parsed = fetchInputSchema.parse(input);
  const { key: datasetKey, canonical } = await buildDatasetKey(parsed.filters);
  const pageKey = buildPageKey(datasetKey, canonical.page);

  let dataset = await readDataset(env.RAWG_CACHE, pageKey);
  let cacheStatus: FetchOutput["cacheStatus"] = dataset ? "hit" : "miss";

  if (!dataset || parsed.force || shouldRefresh(dataset)) {
    dataset = await handleFetchDataset(env, datasetKey, canonical);
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
