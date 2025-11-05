"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { type FormEvent } from "react";

import { ChatComposer } from "@/components/ChatComposer";
import { MessageTranscript } from "@/components/MessageTranscript";
import { SuggestionChips } from "@/components/SuggestionChips";
import { ThinkingTimelinePanel } from "@/components/ThinkingTimelinePanel";
import { useAgentChat } from "@/hooks/useAgentChat";

export default function Home() {
  const {
    input,
    setInput,
    handleSubmit,
    stop,
    error,
    clearError,
    messages,
    isStreaming,
    suggestedPrompts,
    onSelectSuggestion,
  } = useAgentChat();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(event);
  };

  return (
    <main className="mx-auto flex h-[calc(100vh-6rem)] flex-col gap-8 px-6 pt-4 sm:w-screen md:w-4/5 lg:w-3/4 xl:w-4/6 lg:gap-10">
      <section className="relative flex h-full flex-col rounded-3xl border border-zinc-900/10 bg-zinc-950/5 p-6 backdrop-blur-2xl shadow-[0_40px_120px_-40px_rgba(63,97,255,0.45)]">
        <ThinkingTimelinePanel />
        {messages.length === 0 && input.length === 0 ? (
          <div className="mb-6 flex flex-1 items-center justify-center">
            <h1 className="text-center text-3xl font-bold tracking-wide text-zinc-300">
              Chat with RAWG.io
            </h1>
          </div>
        ) : null}
        <div className="flex flex-1 flex-col justify-between gap-6 overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <MessageTranscript messages={messages} isStreaming={isStreaming} />
          </div>

          {messages.length === 0 && input.length === 0 ? (
            <SuggestionChips
              prompts={suggestedPrompts}
              disabled={isStreaming}
              onSelect={onSelectSuggestion}
            />
          ) : null}
        </div>

        <div className="mt-6">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={onSubmit}
            onStop={stop}
            isStreaming={isStreaming}
          />

          {error ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs font-semibold text-rose-300 hover:text-rose-200"
                onClick={() => clearError()}
              >
                Dismiss error
              </button>
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error.message}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
