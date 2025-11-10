import { useCallback, useEffect, useMemo, useState } from "react";
import { Chat, useChat, type UseChatHelpers } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import type { AgentUIMessage } from "@/types/Agent";
import { useThinkingStore } from "@/state/thinking-store";
import { buildThinkingRuns } from "@/utils/thinking";
import { useDataAnalysisStore } from "@/state/data-analysis-store";

const SUGGESTED_PROMPTS = [
  "What genre had most games in March 2025?",
  "What was the average rating for PS5 games in Q1 of 2023?",
  "Which platform had better rated games in 2024, Ps5 or Xbox series X?",
  "How does exclusive games compare on playstation platforms compared to xbox?",
];

type ChatHelperState = UseChatHelpers<AgentUIMessage>;

export interface UseAgentChatResult {
  input: string;
  setInput: (value: string) => void;
  sendMessage: (options: { text: string }) => Promise<void>;
  handleSubmit: (event: { preventDefault?: () => void }) => Promise<void>;
  stop: () => void;
  clearError: () => void;
  status: ChatHelperState["status"];
  error: ChatHelperState["error"];
  messages: AgentUIMessage[];
  isStreaming: boolean;
  suggestedPrompts: string[];
  onSelectSuggestion: (prompt: string) => void;
}

export function useAgentChat(): UseAgentChatResult {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: "/api/agent",
        fetch: async (url, options) => {
          const headers = new Headers(options?.headers ?? undefined);
          const headerValue = useDataAnalysisStore.getState().enabled
            ? "true"
            : "false";
          headers.set("X-Data-Analysis-Enabled", headerValue);
          const requestInit: RequestInit = {
            ...(options ?? {}),
            headers,
          };
          return fetch(url, requestInit);
        },
      }),
    []
  );

  const chat = useMemo(
    () =>
      new Chat<AgentUIMessage>({
        transport,
        sendAutomaticallyWhen: ({ messages }) => {
          const last = messages[messages.length - 1];
          if (!last || last.role !== "assistant") {
            return false;
          }
          return last.parts.some((part) => part.type === "tool-call");
        },
      }),
    [transport]
  );

  const { messages, sendMessage, stop, status, error, clearError } =
    useChat<AgentUIMessage>({ chat });
  const setRunsFromMessages = useThinkingStore(
    (state) => state.setFromMessages
  );

  const [input, setInput] = useState("");

  useEffect(() => {
    const { runs, currentRunId } = buildThinkingRuns(messages);
    setRunsFromMessages(runs, currentRunId);
  }, [messages, setRunsFromMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSubmit = useCallback(
    async (event: { preventDefault?: () => void }) => {
      event.preventDefault?.();
      const trimmed = input.trim();
      if (!trimmed || isStreaming) {
        return;
      }
      setInput("");
      await sendMessage({ text: trimmed });
    },
    [input, isStreaming, sendMessage]
  );

  const onSelectSuggestion = useCallback(
    (prompt: string) => {
      if (isStreaming) {
        return;
      }
      setInput(prompt);
    },
    [isStreaming]
  );

  return {
    input,
    setInput,
    sendMessage,
    handleSubmit,
    stop,
    clearError,
    status,
    error,
    messages,
    isStreaming,
    suggestedPrompts: SUGGESTED_PROMPTS,
    onSelectSuggestion,
  };
}
