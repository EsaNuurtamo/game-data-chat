import { runCalculation, shouldRefresh } from "@game-data/db";
import { z } from "zod";

import { fetchAggregateDataset, readDataset, writeDataset } from "../datasets";
import type { EnvBindings } from "../types";

export const executeToolArgsShape = {
  datasetId: z.string(),
  operation: z.enum(["avg", "count", "min", "max"]),
  field: z.enum(["metacritic", "rating"]),
  groupBy: z.enum(["genres", "platforms"]).optional(),
  fresh: z.boolean().optional(),
} as const;

const executeToolInputSchema = z.object(executeToolArgsShape);

export const executeOutputSchema = z.object({
  datasetId: z.string(),
  operation: z.enum(["avg", "count", "min", "max"]),
  field: z.enum(["metacritic", "rating"]),
  groupBy: z.string().nullable(),
  value: z.unknown(),
  itemsProcessed: z.number(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
});

export type ExecuteInput = z.infer<typeof executeToolInputSchema>;
export type ExecuteOutput = z.infer<typeof executeOutputSchema>;

export async function handleExecuteCalculation(
  input: ExecuteInput,
  env: EnvBindings
): Promise<ExecuteOutput> {
  const parsed = executeToolInputSchema.parse(input);
  const dataset = await readDataset(env.RAWG_CACHE, parsed.datasetId);

  if (!dataset) {
    throw new Error(
      `Dataset ${parsed.datasetId} not found in cache. Fetch it using fetch_game_data before running calculations.`
    );
  }

  const latestDataset =
    parsed.fresh || shouldRefresh(dataset)
      ? await fetchAggregateDataset(env, dataset.key, dataset.filters)
      : dataset;

  await writeDataset(env.RAWG_CACHE, latestDataset.key, latestDataset);

  const calcResult = runCalculation({
    dataset: latestDataset,
    operation: parsed.operation,
    field: parsed.field,
    groupBy: parsed.groupBy,
  });

  console.log(
    "[mcp] execute_calculation",
    JSON.stringify({
      datasetId: parsed.datasetId,
      operation: parsed.operation,
      groupBy: parsed.groupBy ?? null,
      itemsProcessed: calcResult.itemsProcessed,
      totalItems: latestDataset.items.length,
    })
  );

  return executeOutputSchema.parse({
    datasetId: parsed.datasetId,
    operation: parsed.operation,
    field: parsed.field,
    groupBy: parsed.groupBy ?? null,
    value: calcResult.value ?? null,
    itemsProcessed: calcResult.itemsProcessed,
    fetchedAt: latestDataset.fetchedAt,
    expiresAt: latestDataset.expiresAt,
  });
}
