import { useMemo } from "react";

import { useThinkingStore } from "@/state/thinking-store";

function formatDuration(startedAt?: string, completedAt?: string) {
  if (!startedAt) {
    return null;
  }
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }
  const totalSeconds = Math.max(1, Math.round((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function ThinkingIndicator({
  runId,
  label,
  isCurrentRun = false,
  isStreaming = false,
  isPending = false,
}: {
  runId: string;
  label: string;
  isCurrentRun?: boolean;
  isStreaming?: boolean;
  isPending?: boolean;
}) {
  const run = useThinkingStore((state) => state.runs[runId]);
  const panelState = useThinkingStore((state) => ({
    panelOpen: state.panelOpen,
    currentRunId: state.currentRunId,
  }));
  const togglePanelForRun = useThinkingStore(
    (state) => state.togglePanelForRun
  );

  const { shouldRender, primary, secondary, isPulsing, dotColor } =
    useMemo(() => {
      if (!run && isPending) {
        return {
          shouldRender: true,
          primary: "Connecting…",
          secondary: "",
          isPulsing: true,
          dotColor: "bg-indigo-300",
        } as const;
      }

      if (!run || run.steps.length === 0) {
        return {
          shouldRender: false,
          primary: "",
          secondary: "",
          isPulsing: false,
          dotColor: "bg-indigo-300",
        } as const;
      }

      const latestStep = run.steps[run.steps.length - 1];
      const activeStep =
        run.status === "streaming"
          ? (run.steps.find((step) => step.status === "in-progress") ??
            latestStep)
          : latestStep;

      if (run.status === "failed") {
        return {
          shouldRender: true,
          primary: "Something went wrong",
          secondary: activeStep?.label
            ? `during “${activeStep.label}”`
            : "during calculation",
          isPulsing: false,
          dotColor: "bg-rose-400",
        } as const;
      }

      const finishingResponse = isCurrentRun && isStreaming;

      if (run.status === "succeeded" && !finishingResponse) {
        const duration = formatDuration(run.startedAt, run.completedAt);
        return {
          shouldRender: true,
          primary: "Completed",
          secondary: duration ? `in ${duration}` : "",
          isPulsing: false,
          dotColor: "bg-emerald-400",
        } as const;
      }

      return {
        shouldRender: true,
        primary: finishingResponse ? "Finalizing response…" : "Thinking…",
        secondary: activeStep?.label ?? "",
        isPulsing: !run.hasText,
        dotColor: "bg-indigo-300",
      } as const;
    }, [run, isCurrentRun, isStreaming, isPending]);

  const panelOpenForThisRun =
    panelState.panelOpen && panelState.currentRunId === runId;
  const canToggle = Boolean(run);

  return (
    <button
      type="button"
      onClick={() => {
        if (canToggle) {
          togglePanelForRun(runId);
        }
      }}
      disabled={!canToggle}
      className={`group flex w-full items-center justify-between text-left text-xs text-indigo-100 transition ${
        canToggle ? "hover:text-white" : "cursor-default opacity-80"
      }`}
      aria-expanded={panelOpenForThisRun}
    >
      <span className="flex items-center gap-2">
        <span className="font-semibold uppercase tracking-wide text-zinc-300">
          {label}
        </span>
        <span className="relative flex h-2.5 w-2.5">
          {isPulsing ? (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-300 opacity-75" />
          ) : null}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`}
          />
        </span>
        <span className="text-[11px] italic text-indigo-200 group-hover:text-white">
          {`${secondary || primary || "Connecting..."}`}
        </span>
      </span>
      <span className="text-[10px] uppercase tracking-[0.3em] text-indigo-300 group-hover:text-white">
        {panelOpenForThisRun ? "Hide" : "Details"}
      </span>
    </button>
  );
}
