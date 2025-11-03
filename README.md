# Game Data Chat

Server-side MCP tools plus a Next.js UI for exploring RAWG game data with the OpenAI Responses API.

This monorepo delivers a small vertical slice that runs locally and is intended to deploy to Cloudflare Workers (MCP server) and Cloudflare Pages (UI). The goal is a production-ready skeleton that can answer structured analytics questions about video games.

## Architecture Overview

- **`packages/mcp`** – Cloudflare Worker that implements the Model Context Protocol over JSON-RPC, exposes `fetch_game_data` and `execute_calculation`, and caches RAWG responses in Cloudflare KV.
- **`packages/app`** – Next.js 16 app-router project that hosts a simple agent playground. Server Actions call the OpenAI Responses API to run the loop with the remote MCP worker.
- **`packages/db`** – Shared TypeScript utilities and Zod schemas used by both worker and UI. Designed to target Cloudflare KV today and other storage engines later.
- **`scripts/`** – Workspace utilities, including RAWG dataset fetchers for tags, platforms, and developers.

For a deeper look at the implementation goals and open questions, see:

- `INSTRUCTIONS.md` – Original challenge brief.
- `docs/debug-panel.md` – Debugging panel roadmap.
- `docs/calculation-query-language.md` – Plans for richer calculation queries and traceability.

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable`)
- RAWG API key (<https://rawg.io/apidocs>)
- OpenAI API key with access to `gpt-4o-mini` (or compatible)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Create `packages/mcp/.dev.vars`:

```bash
cd packages/mcp
cat <<'EOF' > .dev.vars
RAWG_API_KEY=your_rawg_api_key
EOF
```

Create `packages/app/.env.local`:

```bash
cd packages/app
cat <<'EOF' > .env.local
OPENAI_API_KEY=your_openai_key
# Optional: override the default model (defaults to gpt-4o-mini)
# OPENAI_MODEL=gpt-4o-mini
MCP_BASE_URL=http://127.0.0.1:8787
EOF
```

### 3. Run Services

```bash
# Terminal 1 – MCP worker
pnpm dev:mcp

# Terminal 2 – Next.js UI
pnpm dev:app
```

- Worker: http://127.0.0.1:8787 (health check at `/health`)
- UI: http://localhost:3000 (test sample evaluation to verify tool calls)

### Useful Scripts

- `pnpm typecheck` – Run TypeScript across all workspaces.
- `pnpm lint` – Lint Next.js app.
- `pnpm build` – Placeholder aggregate build.
- `pnpm fetch:rawg <resource>` – Fetch a RAWG collection to `data/` (see `scripts/rawg-fetch.mjs`).
- `pnpm get-slugs <resource>` – Derive slug lists from downloaded datasets.

## Approach & Current Status

1. **MCP Worker** – Implements basic MCP lifecycle and tools on Cloudflare Workers. Responses are cached per canonicalized request for ~1 hour. (`packages/mcp/src/index.ts`)
2. **Agent UI** – Simple evaluation harness that runs server-side to avoid exposing API keys. Needs expanded visualization for debugging (see roadmap).
3. **Data Utilities** – `@game-data/db` holds shared schemas and cache helpers, enabling future storage backends without rewriting consumers.

## Known Limitations & Roadmap

- **Debugging & Observability** – The UI lacks a proper debugging panel and trace visualization for tool calls. See `docs/debug-panel.md` for planned upgrades such as structured timelines, request/response inspection, and error surfacing.
- **Calculation Query Language** – Calculations are limited to averages/counts. `docs/calculation-query-language.md` outlines richer operations (percentiles, grouped stats) and the trace format needed for review.
- **Deployment Guides** – Cloudflare deployment steps are still pending. Add instructions once Pages & Workers configs stabilize.
- **Automated Evaluations** – Current evaluation panel uses deterministic prompts without assertions. Extend to structured checks with diff support.

## Challenge Context

This project was built for the “Supercell Technical Assessment: Game Analytics MCP Server.” See `INSTRUCTIONS.md` for requirements, evaluation criteria, and submission expectations.

### Time & Effort (to document before submission)

- Planning & architecture review – _capture hours here_
- MCP worker foundation – _capture hours here_
- UI & evaluation harness – _capture hours here_
- Documentation & research – _capture hours here_

> Keep this section updated as you work; the challenge requires a rough breakdown when submitting.

## Contributing / Next Steps

1. Review `docs/debug-panel.md` and design the debugging UI.
2. Prototype the calculation language extensions described in `docs/calculation-query-language.md`.
3. Add deployment automation (Wrangler/Pages) and document smoke tests.

Please open issues or discussion threads to propose additional enhancements.
