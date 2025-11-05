import type { AgentUIMessage } from "@/types/Agent";
import type { ThinkingRun, ThinkingRunStatus } from "@/state/thinking-store";
import type { ThinkingStep } from "@/types/Agent";

interface BuildRunsResult {
  runs: Record<string, ThinkingRun>;
  currentRunId: string | null;
}

export function buildThinkingRuns(messages: AgentUIMessage[]): BuildRunsResult {
  const runStepMaps = new Map<string, Map<string, ThinkingStep>>();
  const runMeta = new Map<
    string,
    {
      status: ThinkingRunStatus;
      startedAt?: string;
      completedAt?: string;
      messageId?: string;
      hasText?: boolean;
    }
  >();

  let activeRunId: string | null = null;

  for (const message of messages) {
    let messageRunId: string | null = null;
    let messageHasText = false;

    for (const part of message.parts) {
      if (part.type === "data-thinking-reset") {
        activeRunId = part.data.runId;
        messageRunId = part.data.runId;
        if (!runStepMaps.has(activeRunId)) {
          runStepMaps.set(activeRunId, new Map());
        }
        if (!runMeta.has(activeRunId)) {
          runMeta.set(activeRunId, { status: "streaming" });
        }
        continue;
      }

      if (part.type === "data-thinking-step") {
        const candidateRunId =
          part.data.runId ?? activeRunId ?? part.data.id;
        if (!candidateRunId) {
          continue;
        }
        const runId = candidateRunId;
        activeRunId = runId;
        messageRunId = runId;

        let stepMap = runStepMaps.get(runId);
        if (!stepMap) {
          stepMap = new Map();
          runStepMaps.set(runId, stepMap);
        }

        const step: ThinkingStep = {
          ...part.data,
          runId: part.data.runId ?? runId,
        };

        stepMap.set(step.id, step);

        const meta = runMeta.get(runId) ?? { status: "streaming" as ThinkingRunStatus };

        const existingStart = meta.startedAt
          ? new Date(meta.startedAt).getTime()
          : undefined;
        const stepStart = new Date(step.startedAt).getTime();
        if (
          Number.isFinite(stepStart) &&
          (existingStart === undefined || stepStart < existingStart)
        ) {
          meta.startedAt = step.startedAt;
        }

        if (step.completedAt) {
          const completedAtTime = new Date(step.completedAt).getTime();
          const existingCompleted = meta.completedAt
            ? new Date(meta.completedAt).getTime()
            : undefined;
          if (
            Number.isFinite(completedAtTime) &&
            (existingCompleted === undefined || completedAtTime > existingCompleted)
          ) {
            meta.completedAt = step.completedAt;
          }
        }

        if (step.status === "failed") {
          meta.status = "failed";
        }

        runMeta.set(runId, meta);
      }

      if (part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0) {
        messageHasText = true;
      }
    }

    if (message.role === "assistant") {
      const candidateRunId = messageRunId ?? activeRunId;
      if (candidateRunId) {
        const meta = runMeta.get(candidateRunId) ?? {
          status: "streaming" as ThinkingRunStatus,
        };
        if (!meta.messageId || messageHasText) {
          meta.messageId = message.id;
        }
        if (messageHasText) {
          meta.hasText = true;
        }
        runMeta.set(candidateRunId, meta);
      }
    }
  }

  const runs: Record<string, ThinkingRun> = {};

  for (const [runId, stepMap] of runStepMaps) {
    const steps = Array.from(stepMap.values()).sort(
      (a, b) =>
        new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );

    const meta = runMeta.get(runId) ?? { status: "streaming" as ThinkingRunStatus };
    const hasFailed = steps.some((step) => step.status === "failed");
    const hasInProgress = steps.some((step) => step.status === "in-progress");
    const finalStatus: ThinkingRunStatus = hasFailed
      ? "failed"
      : hasInProgress
      ? "streaming"
      : steps.length > 0
      ? "succeeded"
      : meta.status;

    runs[runId] = {
      runId,
      steps,
      status: finalStatus,
      startedAt:
        meta.startedAt ??
        steps[0]?.startedAt ??
        new Date().toISOString(),
      completedAt: meta.completedAt,
      messageId: meta.messageId,
      hasText: meta.hasText,
    };
  }

  return {
    runs,
    currentRunId: activeRunId ?? null,
  };
}
