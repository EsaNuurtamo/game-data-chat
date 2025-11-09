import type { DatasetMetadata } from "./dataset";
import { runJsonQuery } from "./jsonQuery";

export interface ExecuteCalculationInput {
  dataset: DatasetMetadata;
  query: string;
}

export interface ExecuteCalculationResult {
  itemsProcessed: number;
  value: unknown;
}

export function runCalculation({
  dataset,
  query,
}: ExecuteCalculationInput): ExecuteCalculationResult {
  const value = runJsonQuery(dataset, query);
  return {
    itemsProcessed: dataset.items.length,
    value,
  };
}
