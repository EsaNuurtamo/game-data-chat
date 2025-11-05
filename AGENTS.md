# Game Data Chat – Agent Notes

Centralized guidance for anyone iterating on the RAWG analytics agent, MCP worker, or supporting UI.

## Quick Links

- [`README.md`](./README.md) – Project overview, local dev instructions, and roadmap.
- [`INSTRUCTIONS.md`](./INSTRUCTIONS.md) – Original Supercell assessment brief.
- [`docs/debug-panel.md`](./docs/debug-panel.md) – Planned debugging & observability panel.
- [`docs/calculation-query-language.md`](./docs/calculation-query-language.md) – Roadmap for richer calculations & traces.
- [`plans/local-first-shot.md`](./plans/local-first-shot.md) – Current implementation priorities.

## Architecture Snapshot

| Package | Purpose |
| --- | --- |
| `packages/mcp` | Cloudflare Worker MCP server exposing `fetch_game_data` + `execute_calculation`, uses Cloudflare KV for caching. |
| `packages/app` | Next.js 16 agent UI running OpenAI Responses API server-side with support for evaluation prompts. |
| `packages/db` | Shared schemas, filter canonicalization, cache helpers; designed to swap storage backends later. |

Shared configuration lives in `tsconfig.base.json`; `pnpm-workspace.yaml` wires the repo as a single workspace.

## Local Development Checklist

1. Install deps: `pnpm install`
2. Configure secrets:
   - `packages/mcp/.dev.vars` → `RAWG_API_KEY=…`
   - `packages/app/.env.local` → `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `MCP_BASE_URL`
3. Run dev servers:
   - `pnpm dev:mcp` (Worker at http://127.0.0.1:8787)
   - `pnpm dev:app` (UI at http://localhost:3000)
4. Optional utilities:
   - `pnpm fetch:rawg <resource>` → download RAWG datasets to `data/`
   - `pnpm get-slugs <resource>` → derive slug lists for prompts or tests

Refer to `README.md` for full setup details and command explanations.

## Code Conventions

- Component file names should use UpperCamelCase (e.g., `ThinkingStepsPanel.tsx`) so UI modules stay easy to locate across the workspace.

## Operational Best Practices

- **Trace Every Step** – Instrument tool calls and agent loops so runs can be replayed in the upcoming debugging panel. Structured traces keep investigations fast. citeturn0search0
- **Monitor Latency & Cost** – Track token usage, RAWG retries, and cache effectiveness. This prevents runaway loops and aligns with industry guidance on LLM observability. citeturn0search1turn0search2
- **Keep Golden Runs Fresh** – Update evaluation prompts and expected traces whenever tools change; compare runs via the planned golden diff view. citeturn0search7
- **Export Traces When Needed** – Use OTEL-compatible payloads so you can push data to external platforms (LangSmith, Datadog) for deeper analysis. citeturn0search6turn0reddit17

## Proving Calculations to Users

We need an experience that makes it obvious _why_ the agent’s answer is trustworthy.

- **Inline “Activity” Summaries** – Keep the per-turn thinking panel visible with a single-click drawer that shows tool inputs/outputs, raw counts, and any cache usage. Highlight steps that contribute to the numeric answer so users can skim provenance fast.
- **Calculation Receipts** – Plan a collapsible block beneath each answer that restates the query, filters applied, dataset counts, arithmetic performed (e.g., “Average Metacritic = sum(scores)/count”), and links to the underlying RAWG page when possible.
- **Visual Diff Mode** – When an answer updates an earlier run, offer a tiny sparkline or badge (“Metacritic avg ↑ +2.1 since last run”) so change is obvious.
- **Golden Run Badges** – For evaluation prompts, display a green/red badge next to the answer showing whether it matches the saved golden output. Clicking the badge opens the golden run diff view in the debug panel.
- **Downloadable Trace Bundle** – Provide a “Download calculation bundle” button that exports the tool inputs/outputs and aggregate metrics as JSON. Power users can replay the exact flow elsewhere.

Document progress on these items in `docs/debug-panel.md` and keep the design artifacts close to the code so future contributors know the bar for transparency.

## Immediate Focus Areas

- Implement the debugging panel features in `docs/debug-panel.md` (timeline + receipts first).
- Extend calculation DSL & trace output per `docs/calculation-query-language.md`; ensure every new calculation shape exports the metadata needed for receipts.
- Harden evaluation assertions and surface regressions in the UI (golden run badges + diff tooling).

Follow the plan in `plans/local-first-shot.md` for sequencing. Update this document as new workflows or tooling tips emerge.
