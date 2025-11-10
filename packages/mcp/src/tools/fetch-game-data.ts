import {
  buildDatasetKey,
  fetchFiltersSchema,
  readDataset,
  shouldRefresh,
  writeDataset,
} from "@game-data/db";
import { z } from "zod";

import { fetchAggregateDataset } from "../data/datasets";
import type { EnvBindings } from "../env";

export const fetchToolArgsShape = {
  filters: fetchFiltersSchema,
  force: z.boolean().optional(),
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
  pageSize: z.number(),
});

export const fetchOutputSchema = z.object({
  datasetId: z.string(),
  datasetKey: z.string(),
  cacheStatus: z.enum(["hit", "miss", "refresh"]),
  totalPages: z.number(),
  totalItems: z.number(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  filters: filtersOutputSchema,
});

export type FetchInput = z.infer<typeof fetchInputSchema>;
export type FetchOutput = z.infer<typeof fetchOutputSchema>;

export async function handleFetchGameData(
  input: FetchInput,
  env: EnvBindings
): Promise<FetchOutput> {
  const parsed = fetchInputSchema.parse(input);
  const { key: datasetKey, canonical } = await buildDatasetKey(parsed.filters);

  let dataset = await readDataset(env.RAWG_CACHE, datasetKey);
  let cacheStatus: FetchOutput["cacheStatus"] = dataset ? "hit" : "miss";

  if (!dataset || parsed.force || shouldRefresh(dataset)) {
    dataset = await fetchAggregateDataset(env, datasetKey, canonical);
    await writeDataset(env.RAWG_CACHE, datasetKey, dataset);
    cacheStatus = dataset
      ? cacheStatus === "hit"
        ? "refresh"
        : "miss"
      : cacheStatus;
  }

  if (!dataset) {
    throw new Error("Failed to retrieve dataset from RAWG cache");
  }

  console.log(
    "[mcp] fetch_game_data",
    JSON.stringify({
      datasetKey,
      pagesFetched: dataset.totalPages,
      totalItems: dataset.items.length,
      cacheStatus,
    })
  );

  return fetchOutputSchema.parse({
    datasetId: datasetKey,
    datasetKey,
    cacheStatus,
    totalPages: dataset.totalPages,
    totalItems: dataset.items.length,
    fetchedAt: dataset.fetchedAt,
    expiresAt: dataset.expiresAt,
    filters: dataset.filters,
  });
}
