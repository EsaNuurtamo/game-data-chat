# Local Development Guide

This repository ships a small vertical slice that lets you test the RAWG-backed MCP worker and the Next.js agent UI on your laptop. Follow the steps below to configure environment variables, start both services, and sanity check the toolchain.

## Prerequisites
- Node.js 20 or newer (Workers dev server needs the `fetch` globals shipped in Node 20+).
- pnpm 9+ (`corepack enable` is recommended).
- A RAWG API key (<https://rawg.io/apidocs>).
- An OpenAI API key with access to `gpt-4o-mini` (or any compatible chat model) for the ai/sdk agent.

## 1. Install dependencies

```bash
pnpm install
```

This installs shared dependencies in the workspace and links the three packages (`app`, `db`, `mcp`).

## 2. Configure secrets

### Worker (packages/mcp)

Create an environment file for Wrangler and add your RAWG key:

```bash
cd packages/mcp
echo 'RAWG_API_KEY=your_rawg_api_key_here' > .dev.vars
```

The worker stores fetched datasets in Cloudflare KV. Wrangler automatically provisions an in-memory KV namespace for `RAWG_CACHE` during `wrangler dev` using the binding declared in `wrangler.toml`.

### Next.js app (packages/app)

Create `.env.local` with the credentials and MCP base URL:

```bash
cd packages/app
cat <<'EOF' > .env.local
OPENAI_API_KEY=your_openai_key
# Optional: override the default model (defaults to gpt-4o-mini)
# OPENAI_MODEL=gpt-4o-mini
MCP_BASE_URL=http://127.0.0.1:8787
EOF
```

The UI agent route (`/api/agent`) uses `ai/sdk` v5 and calls the worker through `MCP_BASE_URL`.

## 3. Run the services

Open two terminals from the repository root:

1. **MCP worker**
   ```bash
   pnpm dev:mcp
   ```
   Wrangler serves the Worker on <http://127.0.0.1:8787>. Check <http://127.0.0.1:8787/health> to confirm the runtime responds.

2. **Next.js app**
   ```bash
   pnpm dev:app
   ```
   Visit <http://localhost:3000>. Use the form to ask a question or trigger the “Run Sample Query” evaluation to verify the roundtrip.

## 4. Useful scripts

- `pnpm typecheck` – runs `tsc --noEmit` across all packages.
- `pnpm lint` – currently targets the Next.js app (ESLint).
- `pnpm build` – placeholder that fans out to package builds once they exist.

## 5. Notes & TODOs

- The worker now speaks MCP over JSON-RPC at `/mcp`, supporting `initialize`, `tools/list`, and `tools/call`. It surfaces two tools (`fetch_game_data`, `execute_calculation`) that the Next.js agent discovers at runtime.
- RAWG responses are cached per query/page for six hours in KV. Set the `force` flag in the tool call to bypass the cache when needed.
- The evaluation panel uses a deterministic sample prompt. Results are plain text today; expand to structured assertions when we add automated tests.
