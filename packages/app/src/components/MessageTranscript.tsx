"use client";

import type { ReactNode } from "react";

import type { AgentUIMessage } from "@/types/Agent";
import type { ThinkingRun } from "@/state/thinking-store";
import { useThinkingStore } from "@/state/thinking-store";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MessageParts } from "./MessageParts";
import { ThinkingIndicator } from "./ThinkingIndicator";

interface MessageTranscriptProps {
  messages: AgentUIMessage[];
  isStreaming: boolean;
}

export function MessageTranscript({
  messages,
  isStreaming,
}: MessageTranscriptProps) {
  const containerRef = useAutoScroll<HTMLDivElement>({
    shouldScroll: messages.length > 0,
  });

  if (messages.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef} className="max-h-full overflow-y-auto pr-1">
      <ul className="space-y-4">
        {messages.map((message) => (
          <TranscriptMessage
            key={message.id}
            message={message}
            isStreaming={isStreaming}
          />
        ))}
      </ul>
    </div>
  );
}

function TranscriptMessage({
  message,
  isStreaming,
}: {
  message: AgentUIMessage;
  isStreaming: boolean;
}) {
  const run = useThinkingStore((state) => state.getRunByMessageId(message.id));
  const currentRunId = useThinkingStore((state) => state.currentRunId);
  const isAssistant = message.role === "assistant";
  const hasText = message.parts.some((part) => part.type === "text");
  const isPendingAssistant = isAssistant && !run && isStreaming && !hasText;
  const limitGuidance =
    isAssistant && !hasText ? deriveLimitGuidance(run) : null;

  const bubbleClasses = isAssistant
    ? "bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent border border-indigo-500/20"
    : "bg-zinc-800/60 border border-zinc-700/70";
  const label = (
    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
      {isAssistant ? "Agent" : "You"}
    </span>
  );

  const leftContent = isAssistant ? (
    <ThinkingIndicator
      runId={run?.runId ?? `pending-${message.id}`}
      label="Agent"
      isCurrentRun={run ? run.runId === currentRunId : isPendingAssistant}
      isStreaming={isStreaming}
      isPending={isPendingAssistant}
    />
  ) : (
    label
  );

  const messageContent = resolveMessageContent({
    message,
    run,
    hasText,
    isPendingAssistant,
    limitGuidance,
  });

  return (
    <li className={`rounded-2xl px-5 py-4 ${bubbleClasses}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        {leftContent}
      </div>
      {messageContent}
    </li>
  );
}

interface MessageContentOptions {
  message: AgentUIMessage;
  run?: ThinkingRun | null;
  hasText: boolean;
  isPendingAssistant: boolean;
  limitGuidance: LimitGuidance | null;
}

function resolveMessageContent({
  message,
  run,
  hasText,
  isPendingAssistant,
  limitGuidance,
}: MessageContentOptions): ReactNode {
  if (hasText) {
    return <MessageParts message={message} />;
  }

  if (limitGuidance) {
    return <LimitGuidanceNotice guidance={limitGuidance} />;
  }

  if (run) {
    return <MessageParts message={message} />;
  }

  if (isPendingAssistant) {
    return <p className="text-sm text-indigo-200/70">Waiting on agent…</p>;
  }

  return null;
}

interface LimitGuidance {
  countText: string;
}

function LimitGuidanceNotice({ guidance }: { guidance: LimitGuidance }) {
  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm text-indigo-100/90">
      <h3 className="text-base font-semibold text-indigo-100">
        Try Narrowing Your Filters
      </h3>
      <p className="mt-2">
        RAWG matched {guidance.countText}, but this agent caps datasets at{" "}
        <strong>2,000</strong> titles to stay performant.
      </p>
      <p className="mt-3 text-xs uppercase tracking-widest text-indigo-200/70">
        Tips
      </p>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        <li>
          Add a platform or parent platform filter (for example,
          <code className="ml-1 rounded bg-indigo-500/20 px-1 py-0.5 font-mono text-xs text-indigo-200">
            platforms: ps5
          </code>
          ).
        </li>
        <li>
          Limit the release window with
          <code className="ml-1 rounded bg-indigo-500/20 px-1 py-0.5 font-mono text-xs text-indigo-200">
            releasedFrom
          </code>
          /
          <code className="ml-1 rounded bg-indigo-500/20 px-1 py-0.5 font-mono text-xs text-indigo-200">
            releasedTo
          </code>
          .
        </li>
        <li>Combine specific genres or tags to target a narrower slice.</li>
      </ul>
    </div>
  );
}

function deriveLimitGuidance(run?: ThinkingRun | null): LimitGuidance | null {
  if (!run || run.status !== "failed") {
    return null;
  }

  const limitStep = run.steps.find(
    (step) =>
      typeof step.error === "string" &&
      step.error.includes("exceeds the maximum allowed")
  );

  if (!limitStep || typeof limitStep.error !== "string") {
    return null;
  }

  const match = limitStep.error.match(/RAWG returned (\d+)/i);
  const count = match ? Number.parseInt(match[1], 10) : null;
  const formattedCount =
    typeof count === "number" && Number.isFinite(count)
      ? count.toLocaleString()
      : "more than 2,000";

  return {
    countText:
      formattedCount === "more than 2,000"
        ? "more than 2,000 games"
        : `${formattedCount} games`,
  };
}
