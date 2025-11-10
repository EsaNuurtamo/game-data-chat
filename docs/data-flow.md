# Data Flow Reference

This document traces every major data transformation from an agent prompt to the final response, with pointers to the relevant code. Use it to understand what the LLM must output for each tool call, how those payloads are normalized, and where the merged datasets live.

## 1. Agent → MCP Tool Calls

1. A chat request hits `createConversationAgentResponse` (`packages/app/src/lib/agents/conversationAgent.ts`).  
2. The agent runs on the OpenAI Responses API with the MCP tool registry obtained from the worker.  
3. When the LLM decides to call a tool it must emit a JSON body that matches the tool’s Zod schema; the MCP SDK forwards that JSON directly to the worker.

### Tool Argument Formats Produced by the LLM

| Tool | JSON Shape | Notes |
| --- | --- | --- |
| `fetch_game_data` | `{ "filters": FetchFilters, "force"?: boolean }` | `FetchFilters` comes from `fetchFiltersSchema` (`packages/db/src/filters.ts`). Every array is optional and may contain comma‑separated strings; the worker will clean them up. |
| `execute_calculation` | `{ "datasetId": string, "query": string, "fresh"?: boolean }` | The LLM must copy the `datasetId` returned by the previous `fetch_game_data` call and supply a JSON Query expression (see https://jsonquerylang.org). |

If the LLM’s JSON fails validation, the worker rejects the tool call and the agent reports the error verbatim to the user.

## 2. Filter Normalization Pipeline

1. The worker calls `buildDatasetKey()` (`packages/db/src/dataset.ts`).  
2. That helper invokes `canonicalizeFilters()` (`packages/db/src/filters.ts`) which:
   - Expands comma-separated lists, trims whitespace, lowercases, and slugifies (`normalizeFilterValue`).
   - Sorts `genres`, `platforms`, `parentPlatforms`, and `tags` arrays so equivalent requests hash to the same key.
   - Drops unsupported tags using `SUPPORTED_TAGS`.
   - Fills defaults (`page=1`, `pageSize=DEFAULT_PAGE_SIZE`).
3. The canonical JSON is hashed into the final dataset key: `rawg:<sha256>`.

The resulting `CanonicalizedFilters` object is stored inside every dataset record so later calculations know exactly which filters produced the data.

## 3. RAWG Fetch & Data Normalization

### In-Memory Aggregation

`fetchAggregateDataset()` (`packages/mcp/src/data/datasets.ts`) is the single entry point for RAWG data:

1. Iterates `page = 1…N`, mutating a copy of `CanonicalizedFilters` so each RAWG request only changes the page number.  
2. Calls `fetchRawgDataset()` per page, which adds platform IDs via `resolvePlatformIds()` / `resolveParentPlatformIds()` and enforces the `RAWG_RESULT_HARD_LIMIT` (2,000 games).  
3. Collects all `GameSummary` results in-memory. Because of the hard limit, the aggregate payload stays under both Worker memory limits and the 25 MB KV ceiling.

### GameSummary Sanitization

RAWG responses are parsed through `gameSummarySchema` (`packages/db/src/schemas.ts`):

- Ensures core fields (`id`, `slug`, `name`, scores) exist with the correct types.
- Converts nullable `genres` / `platforms` arrays to empty arrays to simplify later calculations.
- Leaves `rating` / `metacritic` as nullable numbers; downstream calculations decide how to treat `null` or zeroes.

### Aggregate Dataset Record

After all pages load:

1. `dedupeItems()` removes duplicate games (same `id`) across pages.  
2. The freshest `fetchedAt`/`expiresAt` timestamps win so TTLs stay accurate.  
3. The worker writes a single `KvDatasetRecord` to KV via `writeDataset()` under the canonical dataset key. There are no `:pN` page entries anymore.

Structure of `KvDatasetRecord` (`packages/db/src/dataset.ts`):

```ts
{
  key: string;                 // hashed dataset key
  filters: CanonicalizedFilters;
  page: number;                // page requested by the agent (usually 1)
  totalPages: number;          // RAWG count / pageSize ceiling
  fetchedAt: string;           // ISO timestamps
  expiresAt: string;
  items: GameSummary[];
  version: string;             // compared against DATASET_VERSION during reads
}
```

## 4. Calculation Flow

1. The LLM calls `execute_calculation` with the `datasetId` it previously received.  
2. The worker loads the aggregate record from KV (`readDataset()`).  
3. If the caller set `fresh=true` or the record is expired (`shouldRefresh()`), `fetchAggregateDataset()` reruns and overwrites KV.  
4. `runCalculation()` (`packages/db/src/calculations.ts`) delegates to `runJsonQuery()` (`packages/db/src/jsonQuery.ts`), which evaluates the JSON Query expression against the dataset object.  
   - Queries typically start with `.items` and can chain helpers like `unnest`, `groupBy`, `mapValues`, `average`, `limit`, etc.  
   - Custom helper `unnest(.<path>)` expands nested arrays (genres, platforms) so grouping/filtering can operate on flattened rows.  
   - `itemsProcessed` is always the total number of games in the dataset so the UI can report coverage.
5. The tool response echoes timing data (`fetchedAt`, `expiresAt`) so the UI can show staleness hints alongside the numeric answer.

## 5. Response Back to the User

1. The MCP tool response flows back through the Responses API stream.  
2. `forwardThinkingSteps()` in `conversationAgent.ts` emits “thinking” events that capture:
   - Tool name, JSON input, and JSON output for receipts/debugging.
   - Any errors encountered mid-run.
3. UI components such as `ThinkingTimelinePanel` and `MessageTranscript` subscribe to those events and render:
   - Inline “activity” summaries (tool input/output, counts, TTL).  
   - The final assistant message that the LLM generated after seeing the tool outputs.

## Quick Reference Cheat Sheet

- **Tool JSON**  
  - `fetch_game_data`: `{ filters, force? }` → normalized via `fetchFiltersSchema` + `canonicalizeFilters`.  
  - `execute_calculation`: `{ datasetId, query, fresh? }` where `query` is a JSON Query string (e.g., `.items | unnest(.genres) | groupBy(.genres.name) | mapValues(size())`).
- **Normalization points**  
  - Filters slugified/sorted before hashing.  
  - RAWG payload parsed by `gameSummarySchema` (null arrays → []).  
  - Aggregation dedupes items and synchronizes TTLs.
- **Storage**  
  - Only the aggregate dataset is persisted in KV under `rawg:<hash>`.  
  - Reads always validate `version` to prevent stale schema mismatches.
- **Calculations**  
  - Operate entirely in-memory against the cached dataset via JSON Query.  
  - Custom helpers like `unnest` enable genre/platform explosion; otherwise queries can use the standard jsonquery function set.

Use this flow when extending the DSL, adding new filters, or instrumenting traces so every schema change is accounted for from the LLM prompt all the way to the rendered response.
