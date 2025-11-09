# JSON Query Calculations & Traceability

`execute_calculation` now evaluates [JSON Query](https://jsonquerylang.org) expressions directly against cached RAWG datasets. This gives the agent a flexible, auditable way to slice/aggregate data without expanding the bespoke DSL any further.

## Inputs

```json
{
  "datasetId": "rawg:<hash>",
  "query": ".items | …",
  "fresh": false
}
```

- `datasetId` comes from the previous `fetch_game_data` call.  
- `query` must be a JSON Query string (the same syntax shown on jsonquerylang.org). The worker injects one custom helper, `unnest(.path)`, to explode nested arrays like genres or platforms.  
- `fresh` (optional) triggers a RAWG refresh if the cached dataset is stale.

## Example Queries

| Goal | Query |
| --- | --- |
| Count games per genre | `.items \| unnest(.genres) \| groupBy(.genres.name) \| mapValues(size())` |
| Average rating per platform | `.items \| unnest(.platforms) \| groupBy(.platforms.platform.name) \| mapValues(map(.rating) \| average())` |
| Games with rating > 4 | `.items \| filter(.rating > 4)` |
| Top 5 games by rating | `.items \| sort(.rating, "desc") \| limit(5)` |

Feel free to compose additional expressions using standard JSON Query operators: `filter`, `map`, `pick`, `limit`, `groupBy`, `mapValues`, `average`, `sum`, etc.

## Execution Pipeline

1. **Validation** – The worker ensures `query` is a non-empty string before executing it.  
2. **Dataset Refresh** – If the cache entry is expired (or `fresh=true`), RAWG pagination reruns and the aggregate dataset overwrites the KV key.  
3. **Query Evaluation** – `runJsonQuery()` (`packages/db/src/jsonQuery.ts`) executes the expression with the `unnest` helper available. Errors throw `JsonQueryError`, preserving the failing query in the message for easier debugging.  
4. **Result Envelope** – `handleExecuteCalculation()` returns `{ datasetId, query, value, itemsProcessed, fetchedAt, expiresAt }` so the UI can show both the query and the dataset freshness.  
5. **Traces** – `conversationAgent.ts` logs each tool call, its inputs, and outputs so the thinking timeline shows the exact query string alongside counts or sample values.

## Next Steps

- **Trace Bundles** – Capture the executed query plus sampled input/output rows for download.  
- **Query Library** – Surface reusable query snippets (e.g., “Avg rating by parent platform”) inside the UI to lower the barrier for less-technical users.  
- **Safety Checks** – Consider guardrails that detect runaway `unnest` usage or expensive combinations before they reach RAWG quotas.

This JSON Query approach keeps the agent promptable, composable, and easy to observe while still fitting within Cloudflare Worker constraints.
