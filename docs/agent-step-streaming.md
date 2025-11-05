# Agent Step Streaming Plan

## Purpose
- Keep the agent’s reasoning steps visible, auditable, and exportable so users can validate every calculation.
- Align the streaming infrastructure with future debugging panel needs (calculation receipts, golden-run diffs, trace exports).
- Maintain a simple authentication flow via Clerk without slowing local development.

## Current State
- **UI** – The chat surface is componentized (`SuggestionChips`, `MessageTranscript`, `ThinkingStepsPanel`, `ChatComposer`). The composer is pinned to the bottom; inline “Thought for …” summaries sit above each assistant reply.
- **API** – `/api/agent` delegates to `lib/agents/conversationAgent`, which streams `data-thinking-step` / `data-thinking-reset` events with run IDs, tool metadata, and status updates.
- **Auth** – Clerk middleware protects the `(main)` route; the default Clerk modal handles sign-in/out.

## Done
| Area | Status | Notes |
| --- | --- | --- |
| Component refactor | ✅ | Chat experience split into focused components to reduce rerenders and ease future instrumentation. |
| Streaming envelope | ✅ | Step metadata (thoughts, tool calls, results, errors) streams alongside UI messages with run IDs. |
| Inline activity panel | ✅ | Each assistant message renders a collapsible “Thought for …” panel with tool payloads and errors. |
| Clerk integration | ✅ | Signed-out visitors are redirected to Clerk sign-in; signed-in users receive full agent access. |

## Guiding Principles
1. **Traceability** – Every agent action must map to a visible step with provenance data.
2. **User Proof** – The UI should communicate why a number is correct (filters, counts, arithmetic) without opening a developer tool.
3. **Incremental Shipping** – Add transparency features without breaking existing chat/evaluation flows.
4. **Observability Reuse** – The same payload must feed the debugging panel, downloadable traces, and potential OTEL exporters.

## Target Experience
- Inline activity badges summarize duration and status; expanding them shows filters, dataset counts, tool inputs/outputs, and errors.
- Calculation receipts summarize the arithmetic (“Average Metacritic = sum(scores)/count, based on 158 games”) and link to supporting data.
- Golden-run badges indicate whether the latest answer matches the saved baseline, linking to diff tooling.
- Users can export the “proof bundle” (JSON) for audit or reproduction.

## Next Enhancements
1. **Calculation Receipts (UI + debug panel)** – Generate a derived object containing filters, row counts, cache status, arithmetic steps, and display it next to the answer and in the panel.
2. **Golden Run Awareness** – Show pass/fail badges and change deltas when an evaluation prompt is executed.
3. **Trace Export** – Allow downloading or sharing the full reasoning trace (JSON/OTEL) for external analysis.
4. **Debug Panel Integration** – Feed the streaming payload into the upcoming panel timeline and filters.
5. **Metrics & Alerts** – Record per-step latency/token usage and surface slow spans or retry spikes.

## Implementation Checklist
- [ ] Add receipt generation (server) and render inline receipts in the chat.
- [ ] Persist recent run traces (KV or Durable Object) for diffing and download.
- [ ] Extend step payloads with cache metadata, row counts, and arithmetic summaries.
- [ ] Wire debug panel timeline to reuse the same payloads.
- [ ] Write unit tests covering stream parsing + receipt generation.

## Open Questions
- Best persistence layer for short-lived traces (KV vs Durable Object vs client storage)?
- How granular should receipts be (per tool call vs aggregated per answer)?
- Should receipts be visible by default or hidden behind a “Show work” toggle for casual users?
- Do we need throttling/backpressure safeguards if traces become large (e.g., multi-tool workflows)?
