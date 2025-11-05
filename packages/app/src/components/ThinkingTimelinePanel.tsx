"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useThinkingStore } from "@/state/thinking-store";
import type { ThinkingStep } from "@/types/Agent";

function formatTime(value?: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ThinkingTimelinePanel() {
  const { panelOpen, closePanel, currentRunId, runs } = useThinkingStore(
    (state) => ({
      panelOpen: state.panelOpen,
      closePanel: state.closePanel,
      currentRunId: state.currentRunId,
      runs: state.runs,
    })
  );

  const run = currentRunId ? runs[currentRunId] : undefined;

  const steps = useMemo(() => {
    return run
      ? [...run.steps].sort(
          (a, b) =>
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
        )
      : [];
  }, [run]);

  if (!panelOpen || !run) {
    return null;
  }

  return createPortal(
    <aside
      className="fixed right-0 top-0 bottom-0 z-50 flex w-full bg-zinc-950/95 shadow-[0_24px_80px_rgba(79,70,229,0.45)] transition-transform sm:w-[min(32rem,100vw)] lg:w-[min(40rem,60vw)]"
      aria-hidden={!panelOpen}
    >
      <div className="flex h-full w-full flex-col gap-4 overflow-y-auto border-l border-indigo-500/30 px-6 py-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
              Activity
            </h2>
            {run?.startedAt ? (
              <p className="text-xs text-indigo-200/70">
                Started at {formatTime(run.startedAt)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => closePanel()}
            className="rounded-lg border border-indigo-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-200 hover:border-indigo-300 hover:text-white"
          >
            Close
          </button>
        </header>

        {steps.length === 0 ? (
          <p className="text-sm text-indigo-200/80">
            No streamed steps yet. Ask a question to see the activity timeline.
          </p>
        ) : (
          <ol className="space-y-3">
            {steps.map((step) => {
              const datasetId = extractDatasetId(step);
              return (
                <li
                  key={step.id}
                  className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100"
                >
                <details className="group">
                  <summary className="flex cursor-pointer items-start justify-between gap-3 text-left">
                    <div>
                      <p className="font-medium text-indigo-100">
                        {step.label}
                      </p>
                      {step.kind === "thought" && step.body ? (
                        <p className="mt-1 text-xs text-indigo-100/80 overflow-hidden text-ellipsis whitespace-nowrap">
                          {summarizeReasoning(step.body)}
                        </p>
                      ) : null}
                      <p className="text-xs text-indigo-200/70">
                        {formatTime(step.startedAt)}
                        {step.completedAt
                          ? ` → ${formatTime(step.completedAt)}`
                            : ""}
                        </p>
                      </div>
                      <StatusBadge status={step.status} />
                    </summary>
                    <div className="mt-3 space-y-3 text-xs leading-relaxed text-indigo-100/90">
                      {step.body ? (
                        <p className="rounded-lg bg-indigo-500/10 p-3">
                          {step.body}
                        </p>
                      ) : null}
                      {step.tool?.name ? (
                        <p className="uppercase tracking-widest text-indigo-200/70">
                          Tool · {step.tool.name}
                        </p>
                      ) : null}
                      {datasetId ? (
                        <Link
                          href={`/datasets/${encodeURIComponent(datasetId)}`}
                          className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-200 transition hover:border-indigo-300 hover:text-white"
                        >
                          View dataset
                        </Link>
                      ) : null}
                      {step.input !== undefined ? (
                        <CodeBlock title="Input" value={step.input} />
                      ) : null}
                      {step.output !== undefined ? (
                        <CodeBlock title="Output" value={step.output} />
                      ) : null}
                      {step.error ? (
                        <p className="rounded-lg border border-rose-500/50 bg-rose-500/20 p-3 text-rose-100">
                          {step.error}
                        </p>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>,
    document.body
  );
}

function extractDatasetId(step: ThinkingStep): string | null {
  if (step.kind !== "tool") {
    return null;
  }
  const output = step.output;
  const info = extractDatasetInfo(output);
  if (!info) {
    return null;
  }
  return typeof info.datasetId === "string" ? info.datasetId : null;
}

function extractDatasetInfo(
  value: unknown,
  seen = new Set<unknown>()
): { datasetId: string; datasetKey?: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = extractDatasetInfo(entry, seen);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const datasetId =
    typeof record.datasetId === "string" ? record.datasetId : undefined;
  const datasetKey =
    typeof record.datasetKey === "string" ? record.datasetKey : undefined;

  if (datasetId) {
    return { datasetId, datasetKey };
  }

  for (const nestedValue of Object.values(record)) {
    const nested = extractDatasetInfo(nestedValue, seen);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function StatusBadge({ status }: { status: ThinkingStep["status"] }) {
  const { bg, text } = (() => {
    switch (status) {
      case "succeeded":
        return {
          bg: "bg-emerald-500/20 border-emerald-400/60",
          text: "text-emerald-200",
        };
      case "failed":
        return {
          bg: "bg-rose-500/20 border-rose-400/60",
          text: "text-rose-200",
        };
      default:
        return {
          bg: "bg-amber-500/20 border-amber-400/60",
          text: "text-amber-200",
        };
    }
  })();

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${bg} ${text}`}
    >
      {status}
    </span>
  );
}

function summarizeReasoning(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }
  const lines = trimmed.split(/\r?\n+/).filter(Boolean);
  const firstMeaningfulLine = lines.find((line) => line.trim().length > 0);
  if (!firstMeaningfulLine) {
    return "";
  }
  return firstMeaningfulLine.length > 140
    ? `${firstMeaningfulLine.slice(0, 137)}…`
    : firstMeaningfulLine;
}

function CodeBlock({ title, value }: { title: string; value: unknown }) {
  const formatted =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-indigo-200/70">
        {title}
      </p>
      <pre className="max-h-44 overflow-auto rounded-lg bg-zinc-900/70 p-3 text-[11px] leading-tight text-indigo-100/90">
        {formatted}
      </pre>
    </div>
  );
}
