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
MCP_API_KEYS=local-dev-key
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
MCP_API_KEY=local-dev-key
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

- **Calculation Query Language** – Calculations are limited to averages/counts. `docs/calculation-query-language.md` outlines richer operations (percentiles, grouped stats) and the trace format needed for review.
- **Automated Evaluations** – Current evaluation panel uses deterministic prompts without assertions. Extend to structured checks with diff support.

## Process

## Approach

- Never done MCP deployments or worked with Claudflare so researched those first
- Minimal local setup and fast deploy to surface unknown unknowns of Claudeflare early on
- Thinking of ai/sdk and NextJS for nice UX, checked if it works in Claudeflare
- Authentication is a must because of API_KEYS being exploitable so doing a fast one with Clerk
- Went though the docs of RAWG.io to graps what is possible with the data
- Imported OpenApi spec to postman to test some queries
- Planned the work with Codex given the instructions and the openapi spec
- Fetched platforms, tags, parent platforms and developers to pick the important things

## Challenges

- Dealing with the 40 items per page limit in RAWG
- fetch_game_data and calculation are coupled and data needs to be fetched first to some place
- Generalizing is hard because of the special cases "exclisive" is one tag among the many, extracting 6000 tags is not possible -> hardcoding set of useful tags
- Inconsistent data: metacritic scores missing after 2023, metacritic score can be null but rating cannot so even if there is no ratings ratings has 0 => compromise to filter out 0 values from calculations
- Caching/Data storage
  - Not many cache hits as data is now cached with hashed filters as a key and filters are different in most conversations
  - Thought of only allowing time period filter, that way all differen queries for that time period would hit cache
  - Thought of using the 30000 free requests to get all their data to own sql and updating periodically: that way we could enrich the data with embeddings and such
- LLM to SQL kind of approach would be nice for the calculations or code generation, ended up generating the query "language" with LLM. There are also ready made options
- Some statistics like count you can get from the first page of the data req, also median need only 2 queries always
- Doing some calulations while fetching and some after fetch feels like too much to handle given the scope so decided that during fetch_games there is no stats calculations made
- Should I filter from the api only those that have metacritic score? Last years games do not have that and the API does not allow to filter by user ratings

### Time & Effort (to document before submission)

- Planning & architecture - 1h
- MCP worker foundation – 2h
- UI & evaluation harness – 5h
- Documentation & research – 2h
