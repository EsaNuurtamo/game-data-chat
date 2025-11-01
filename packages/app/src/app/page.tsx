"use client";

import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMemo, useRef, useState, type FormEvent } from "react";

import { ChatInputForm } from "@/components/chat-input-form";
import { EvaluationPanel, type EvalStatus } from "@/components/evaluation-panel";
import { MessageParts } from "@/components/message-parts";

const SAMPLE_PROMPT =
  "What is the average Metacritic score for PC games released between January 1 and March 31, 2024? Please reference the dataset id you use.";

function extractTextFromMessage(message: UIMessage): string {
  const textParts = message.parts
    .filter((part) => part.type === "text")
    .map((part) => ("text" in part ? part.text : ""))
    .filter(Boolean);

  if (textParts.length > 0) {
    return textParts.join("\n\n");
  }

  return JSON.stringify(message.parts, null, 2);
}

export default function Home() {
  const [input, setInput] = useState("");
  const [evalStatus, setEvalStatus] = useState<EvalStatus>("idle");
  const [evalOutput, setEvalOutput] = useState("");
  const evaluationPendingRef = useRef(false);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent" }), []);
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
        }
      }),
    [transport]
  );

  const {
    messages,
    sendMessage,
    stop,
    status,
    error,
    clearError
  } = useChat({
    chat,
    onFinish: ({ message }) => {
      if (evaluationPendingRef.current) {
        setEvalOutput(extractTextFromMessage(message));
        setEvalStatus("done");
        evaluationPendingRef.current = false;
      }
    },
    onError: (err) => {
      if (evaluationPendingRef.current) {
        setEvalStatus("error");
        setEvalOutput(err.message);
        evaluationPendingRef.current = false;
      }
    }
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const transcript = useMemo(() => {
    return messages.map((message) => {
      const isAssistant = message.role === "assistant";
      const bubbleClasses = isAssistant
        ? "bg-zinc-100 border border-zinc-200"
        : "bg-indigo-50 border border-indigo-200";

      return (
        <li key={message.id} className={`rounded-lg px-4 py-3 ${bubbleClasses}`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            {isAssistant ? "Agent" : "You"}
          </div>
          <MessageParts message={message} />
        </li>
      );
    });
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }
    await sendMessage({ text: trimmed });
    setInput("");
  };

  const runSampleEvaluation = async () => {
    if (isStreaming) {
      return;
    }
    setEvalStatus("running");
    setEvalOutput("");
    evaluationPendingRef.current = true;
    await sendMessage({ text: SAMPLE_PROMPT });
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Game Data Agent Console</h1>
          <p className="max-w-2xl text-sm text-zinc-600">
            Ask analytical questions about RAWG game data. The AI agent uses the MCP server&apos;s
            <code className="mx-1 rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-700">
              fetch_game_data
            </code>
            and
            <code className="mx-1 rounded bg-zinc-200 px-1 py-0.5 text-xs text-zinc-700">
              execute_calculation
            </code>
            tools exposed via Model Context Protocol.
          </p>
        </header>

        <section className="rounded-lg bg-white p-6 shadow-sm">
          <ChatInputForm
            value={input}
            placeholder={SAMPLE_PROMPT}
            disabled={isStreaming}
            canCancel={isStreaming}
            onChange={setInput}
            onSubmit={handleSubmit}
            onCancel={() => void stop()}
            onUseSample={() => setInput(SAMPLE_PROMPT)}
          />

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start justify-between gap-4">
                <div>{error.message}</div>
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-wide"
                  onClick={() => clearError()}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Conversation
            </h2>
            {messages.length === 0 ? (
              <p className="rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
                Submit a question to see the agent&apos;s reasoning, tool calls, and final answer.
              </p>
            ) : (
              <ul className="space-y-3">{transcript}</ul>
            )}
          </div>
        </section>

        <EvaluationPanel
          status={evalStatus}
          output={evalOutput}
          disabled={isStreaming}
          onRun={runSampleEvaluation}
        />
      </main>
    </div>
  );
}
