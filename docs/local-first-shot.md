# Local First Shot Plan

> Status: ✅ Completed. This document captures the original vertical-slice effort; ongoing UX and streaming transparency work now lives in `plans/agent-step-streaming.md`.

## Goals
- Deliver a locally runnable vertical slice using RAWG data via the MCP server.
- Cache RAWG responses in Cloudflare KV with canonical keys shared between MCP and Next.js layers (pagination is handled in-memory now, so only the aggregate dataset is persisted).
- Provide a simple Next.js UI endpoint to trigger tool usage (manual for now; LLM integration later).
- Keep configurations and environment expectations documented.

## Tasks
1. ✅ Extend `@game-data/db` with canonical query hashing, KV helper interfaces, and calculation utilities.
2. ✅ Implement the Worker endpoints:
   - Bind to KV namespace for dataset caching.
   - Expose `fetch_game_data` (RAWG fetch + KV read-through) and `execute_calculation`.
   - Handle pagination, TTL, and dataset metadata.
   - _Follow-up_: monitor protocol compatibility and expand beyond JSON-RPC HTTP if Streamable HTTP is required.
3. ✅ Wire Next.js server route `/api/agent` that:
   - Uses ai/sdk v5 agent tooling to orchestrate `fetch_game_data` and `execute_calculation`.
   - Streams responses for the chat interface.
4. ✅ Build minimal UI (form + results/evaluation block) hitting `/api/agent`.
5. ✅ Provide environment setup docs (RAWG API key, Cloudflare KV binding via Wrangler, Next env).
6. ✅ Verify locally with `pnpm typecheck`, `pnpm lint`, and document dev server commands.

## Risks / Open Questions
- RAWG rate limits: mitigate with KV TTL and local throttling.
- Calculation scope limited to average/count/group average; extend later.
- Need to decide default TTL (start with 6 hours).

## Deliverables
- Updated packages with working implementations.
- `AGENTS.md` referencing this plan.
- Instructions for environment variables and local dev steps.
