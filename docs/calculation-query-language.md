# Calculation Query Language & Traceability

Our current `execute_calculation` tool supports a small set of operations (`avg`, `count`, `group_avg`). Analysts need richer analytics plus transparent traces to verify results. This document sketches the next iteration.

## Goals

1. **Expressive Metrics** – Add percentile, median, weighted average, top-N filters, and comparisons across dimensions (genres, platforms, release windows).
2. **Human-Readable Syntax** – Provide a concise DSL that balances structure with readability so prompts can request calculations deterministically.
3. **Auditable Traces** – Produce machine- and human-readable execution traces that capture filters, intermediate datasets, and output formatting decisions. citeturn0search0turn0search3

## Proposed DSL Outline

```
CALC <operation> <field>
  FROM dataset:<id|filters>
  GROUP BY <dimension?>
  FILTER <field op value>*
  OPTIONS <key=value>*
  RETURN <format>
```

Examples:

- `CALC percentile rating FROM dataset:latest GROUP BY genres FILTER released>=2024-01-01 OPTIONS percentile=0.9 RETURN table`
- `CALC compare_avg metacritic FROM dataset:raw BY platforms OPTIONS reference=pc RETURN diff`

## Execution Pipeline

1. **Parse & Validate** – Zod schema that enforces allowed operations, fields, and option combinations.
2. **Dataset Retrieval** – Resolve `dataset:<id>` to cached metadata or trigger `fetch_game_data`. Cache hits should be recorded in the trace.
3. **Computation Engine** – Implement reusable aggregation primitives (e.g., quantiles via t-digest) to support large datasets while staying within Worker limits.
4. **Trace Capture** – For each stage, emit structured spans with inputs, record counts, and statistical summaries. This aligns with observability recommendations for LLM pipelines where every transformation is traceable. citeturn0search4turn0search2
5. **Formatter** – Support tabular, JSON, and natural-language summaries while preserving the raw result for downstream checks.

## Trace Schema Draft

```json
{
  "calculationId": "calc_2025-11-03T18:20:11.000Z",
  "operation": "percentile",
  "field": "rating",
  "groups": ["genres"],
  "filters": [{"field": "released", "op": ">=", "value": "2024-01-01"}],
  "dataset": {
    "id": "rawg:games:v1:<hash>",
    "itemsFetched": 40,
    "cache": "hit"
  },
  "stages": [
    {"name": "filter", "recordsIn": 40, "recordsOut": 32, "latencyMs": 3},
    {"name": "percentile", "quantile": 0.9, "result": 4.5, "latencyMs": 2}
  ],
  "durationMs": 12,
  "warnings": []
}
```

## Testing & Evaluation

- Add golden calculations with expected traces to the evaluation panel so regressions surface visually. citeturn0search7
- Integrate traces with the debugging panel export to external platforms for longitudinal analysis. citeturn0reddit17turn0search6

## Implementation Phases

1. **Schema & Parser** – Define Zod schemas, extend `@game-data/db` types, and add validation tests.
2. **Core Aggregations** – Implement median/percentile/top-N with unit benchmarks to ensure Workers time constraints are satisfied.
3. **Trace Emission** – Align with the observability plan so traces stream into the UI and optional OTEL exporters.
4. **UI Enhancements** – Update agent responses to cite trace IDs and allow one-click inspection within the debugging panel.

This roadmap ensures calculations stay explainable while unlocking advanced analytics workloads. citeturn0search0turn0search3
