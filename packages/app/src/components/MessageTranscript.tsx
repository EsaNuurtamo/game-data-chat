import type { AgentUIMessage } from "@/types/Agent";
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

  const messageContent =
    hasText || run ? (
      <MessageParts message={message} />
    ) : isPendingAssistant ? (
      <p className="text-sm text-indigo-200/70">Waiting on agent…</p>
    ) : null;

  return (
    <li className={`rounded-2xl px-5 py-4 ${bubbleClasses}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        {leftContent}
      </div>
      {messageContent}
    </li>
  );
}
