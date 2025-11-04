import type { DatasetMetadata } from "./dataset";
import type { GameSummary } from "./schemas";

export const CALCULATION_OPERATIONS = ["avg", "count", "min", "max"] as const;

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

export interface GroupCalculationResult {
  label: string;
  value: number | null;
  count: number;
}

type CalculationItems = {
  items: GameSummary[];
  operation: CalculationOperation;
  field: keyof Pick<GameSummary, "metacritic" | "rating">;
};

interface CalculationResult {
  value: number | null;
  contributing: number;
  total: number;
}

export function calculate({
  items,
  operation,
  field,
}: CalculationItems): CalculationResult {
  if (items.length === 0) {
    return {
      value: operation === "count" ? 0 : null,
      contributing: 0,
      total: 0,
    };
  }

  if (operation === "count") {
    return {
      value: items.length,
      contributing: items.length,
      total: items.length,
    };
  }

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
    return {
      value: null,
      contributing: 0,
      total: items.length,
    };
  }

  switch (operation) {
    case "avg": {
      const sum = numeric.reduce((acc, value) => acc + value, 0);
      return {
        value: sum / numeric.length,
        contributing: numeric.length,
        total: items.length,
      };
    }
    case "min": {
      return {
        value: Math.min(...numeric),
        contributing: numeric.length,
        total: items.length,
      };
    }
    case "max": {
      return {
        value: Math.max(...numeric),
        contributing: numeric.length,
        total: items.length,
      };
    }
    default: {
      const exhaustiveCheck: never = operation;
      throw new Error(`Unsupported operation: ${exhaustiveCheck}`);
    }
  }
}

export function runCalculation({
  dataset,
  operation,
  field,
  groupBy,
}: ExecuteCalculationInput): ExecuteCalculationResult<
  number | null | GroupCalculationResult[]
> {
  const items = dataset.items;

  if (!groupBy) {
    const result = calculate({ items, operation, field });
    return { itemsProcessed: items.length, value: result.value };
  }

  const groups = new Map<string, GameSummary[]>();

  for (const item of items) {
    const members =
      groupBy === "genres"
        ? item.genres.map((genre) => genre.name)
        : item.platforms.map((entry) => entry.platform.name);

    for (const member of members) {
      if (!groups.has(member)) {
        groups.set(member, []);
      }
      groups.get(member)!.push(item);
    }
  }

  const results: GroupCalculationResult[] = Array.from(groups.entries()).map(
    ([label, groupItems]) => {
      const result = calculate({ items: groupItems, operation, field });
      return {
        label,
        value: result.value,
        count: result.contributing,
      };
    }
  );

  return { itemsProcessed: items.length, value: results };
}
