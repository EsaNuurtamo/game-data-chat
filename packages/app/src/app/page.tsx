"use client";

import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useMemo, useState, type FormEvent } from "react";

import { ChatInputForm } from "@/components/chat-input-form";
import { MessageParts } from "@/components/message-parts";

const SUGGESTED_PROMPTS = [
  "Which genre had the best average Metacritic score in 2024?",
  "Compare PlayStation and Xbox exclusives on user ratings.",
  "What were the standout PC RPG releases last year?",
  "How many Switch games scored above 85 in 2023?",
];

function deriveStatus(messages: UIMessage[], status: string): string {
  if (status === "streaming") {
    return "Crafting the response…";
  }
  const reversed = [...messages].reverse();
  for (const message of reversed) {
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-result") {
        return "Going through the stats…";
      }
      if (part.type === "tool-call") {
        return "Getting data…";
      }
    }
  }
  if (status === "submitted") {
    return "Connecting to the agent…";
  }
  return "Ready for your next question";
}

export default function Home() {
  const [input, setInput] = useState("");

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/agent" }),
    []
  );
  const chat = useMemo(
    () =>
      new Chat({
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

  const { messages, sendMessage, stop, status, error, clearError } = useChat({
    chat,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const transcript = useMemo(() => {
    return messages
      .filter((message) => message.parts.some((part) => part.type === "text"))
      .map((message) => {
        const isAssistant = message.role === "assistant";
        const bubbleClasses = isAssistant
          ? "bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent border border-indigo-500/20"
          : "bg-zinc-800/60 border border-zinc-700/70";

        return (
          <li
            key={message.id}
            className={`rounded-2xl px-5 py-4 ${bubbleClasses}`}
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {isAssistant ? "Agent" : "You"}
            </div>
            <MessageParts message={message} />
          </li>
        );
      });
  }, [messages]);

  const statusMessage = useMemo(
    () => deriveStatus(messages, status),
    [messages, status]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) {
      return;
    }
    await sendMessage({ text: trimmed });
    setInput("");
  };

  const handleSuggestion = useCallback(
    async (prompt: string) => {
      if (isStreaming) {
        return;
      }
      setInput("");
      await sendMessage({ text: prompt });
    },
    [isStreaming, sendMessage]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#05060a] via-[#090b12] to-[#0b1320] text-zinc-100">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12 lg:gap-10">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-indigo-300">
            Game Data Lab
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 md:text-5xl">
            Ask about the games that matter
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-zinc-400 md:text-base">
            Your personal analyst for RAWG game data. The agent fetches live
            datasets and runs calculations so you can focus on the insights.
          </p>
        </header>

        <section className="rounded-3xl border border-zinc-800/70 bg-zinc-950/60 p-6 shadow-2xl shadow-indigo-500/10 backdrop-blur">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-400" />
              </span>
              {statusMessage}
            </div>
            {error ? (
              <button
                type="button"
                className="text-xs font-semibold text-rose-300 hover:text-rose-200"
                onClick={() => clearError()}
              >
                Dismiss error
              </button>
            ) : null}
          </div>

          {messages.length === 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSuggestion(prompt)}
                  className="rounded-full border border-zinc-700/70 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-200 transition hover:border-indigo-500/60 hover:text-white"
                  disabled={isStreaming}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="mb-6 space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {transcript.length === 0 ? null : (
              <ul className="space-y-4">{transcript}</ul>
            )}
          </div>

          <ChatInputForm
            value={input}
            placeholder="Ask for trends, comparisons, and insights about game data…"
            disabled={isStreaming}
            canStop={isStreaming}
            onChange={setInput}
            onSubmit={handleSubmit}
            onStop={() => stop()}
          />

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error.message}
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
