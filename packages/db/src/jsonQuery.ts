import {
  compile,
  jsonquery,
  type JSONQuery,
  type JSONQueryOptions,
  type JSONQueryProperty,
} from "@jsonquerylang/jsonquery";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJsonQueryProperty(value: JSONQuery): value is JSONQueryProperty {
  return Array.isArray(value) && value[0] === "get";
}

export class JsonQueryError extends Error {
  query: string;
  cause?: unknown;

  constructor(query: string, cause: unknown) {
    const message =
      cause instanceof Error
        ? `Failed to run JSON query: ${cause.message}`
        : "Failed to run JSON query";
    super(message);
    this.name = "JsonQueryError";
    this.query = query;
    (this as { cause?: unknown }).cause = cause;
  }
}

const jsonQueryOptions: JSONQueryOptions = {
  functions: {
    unnest: (...args: JSONQuery[]) => {
      const path = args[0];
      if (!path || !isJsonQueryProperty(path)) {
        throw new TypeError("unnest() expects a property accessor like .genres");
      }
      const getCollection = compile(path);
      const topLevelKey = typeof path[1] === "string" ? path[1] : null;

      return (input: unknown) => {
        if (!Array.isArray(input)) {
          throw new TypeError("unnest() expects an array as input");
        }

        const exploded: Record<string, unknown>[] = [];

        for (const item of input) {
          const collection = getCollection(item);
          if (!Array.isArray(collection) || collection.length === 0) {
            continue;
          }

          for (const element of collection) {
            const targetKey = topLevelKey ?? "_unnested";
            const base = isRecord(item) ? item : { value: item };
            exploded.push({
              ...base,
              [targetKey]: element,
            });
          }
        }

        return exploded;
      };
    },
  },
};

export function runJsonQuery<TData = unknown, TResult = unknown>(
  data: TData,
  query: string
): TResult {
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    throw new JsonQueryError(query, new Error("Query must be a non-empty string"));
  }

  try {
    return jsonquery(data as unknown, trimmed, jsonQueryOptions) as TResult;
  } catch (error) {
    throw new JsonQueryError(trimmed, error);
  }
}
