Game Data Chat – Agent Notes
============================

Objective
---------
- Build a RAWG-backed MCP server deployed on Cloudflare Workers and expose `fetch_game_data` plus `execute_calculation`.
- Ship a Next.js-based UI (Cloudflare Pages/Functions) that runs the agent loop with OpenAI server-side and surfaces evaluation results.
- Share datamodels/utilities in a reusable `db` package that abstracts Cloudflare KV today, optional SQL later.

Architecture Decisions
----------------------
- Monorepo managed with `pnpm` workspaces.
- Packages:
  - `packages/app`: Next.js 16 App Router + Tailwind UI, server actions host the agent loop with OpenAI Responses API.
  - `packages/mcp`: Cloudflare Worker implementing MCP spec (`@modelcontextprotocol/sdk`), caches RAWG responses, exposes tool endpoints.
  - `packages/db`: Shared TypeScript + Zod schemas, storage helpers (initially KV-based) reused by both app and worker.
- Shared `tsconfig.base.json` at repo root for consistent compiler settings.
- Cloudflare KV planned as primary cache layer; interface in `db` designed so we can swap to Postgres later.

Repository Layout
-----------------
- `package.json` (root): workspace scripts (`dev`, `dev:app`, `dev:mcp`, `typecheck`, `lint`, `build`).
- `pnpm-workspace.yaml`: includes everything under `packages/*`.
- `packages/app`: generated via `create-next-app`, depends on `@game-data/db`.
- `packages/mcp`: Worker entry at `src/index.ts`, exposes a JSON-RPC MCP server at `/mcp` (`wrangler dev`).
- `packages/db`: Exports Zod schemas (`gameSummarySchema`, filter and calculation types).

Local Development Workflow
--------------------------
- Install deps: `pnpm install`.
- Type-check everything: `pnpm typecheck`.
- Run Next dev server: `pnpm dev:app` (defaults to port 3000).
- Run MCP worker locally: `pnpm dev:mcp` (served via `wrangler dev` on port 8787).
- Lint UI code: `pnpm lint`.
- Detailed environment setup steps live in `docs/local-dev.md`.

Immediate Next Steps
--------------------
- Monitor MCP protocol changes and consider upgrading to Streamable HTTP transport when needed.
- Expand calculations (percentiles, medians) and caching for multi-page datasets.
- Flesh out UI evaluation assertions (structured diffs vs. plain text).

Active Plans
------------
- See `plans/local-first-shot.md` for the current implementation roadmap aimed at a locally runnable vertical slice.
