import type { FormEvent } from "react";
import { SendHorizonal, Sparkles, Trash2 } from "lucide-react";

interface ChatInputFormProps {
  value: string;
  placeholder: string;
  disabled: boolean;
  canStop: boolean;
  dataAnalysisEnabled: boolean;
  onToggleDataAnalysis: () => void;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onStop: () => void;
  onClearHistory: () => void;
  canClearHistory: boolean;
}

export function ChatInputForm({
  value,
  placeholder,
  disabled,
  canStop,
  dataAnalysisEnabled,
  onToggleDataAnalysis,
  onChange,
  onSubmit,
  onStop,
  onClearHistory,
  canClearHistory,
}: ChatInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="relative rounded-3xl border border-zinc-800/70 bg-zinc-900/90 shadow-lg shadow-black/30">
        <textarea
          id="prompt"
          name="prompt"
          className="h-28 w-full resize-none rounded-3xl bg-transparent px-5 pb-20 pt-5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 py-4">
          <div className="pointer-events-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onStop}
              disabled={!canStop}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-900 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-rose-500/60 hover:text-rose-200 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
            >
              ⏹
            </button>
            <button
              type="button"
              onClick={onClearHistory}
              disabled={!canClearHistory}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-900 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
              aria-label="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleDataAnalysis}
              disabled={disabled}
              className={`pointer-events-auto group relative flex h-11 items-center gap-2.5 rounded-full border px-4 py-2 transition-all duration-300 ${
                dataAnalysisEnabled
                  ? "border-purple-500/60 bg-gradient-to-r from-purple-500/20 via-purple-500/15 to-indigo-500/20 shadow-lg shadow-purple-500/20"
                  : "border-zinc-700/70 bg-zinc-900 hover:border-zinc-600/80"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <div className="relative flex items-center gap-2">
                <div
                  className={`relative flex h-5 w-9 items-center rounded-full transition-all duration-300 ${
                    dataAnalysisEnabled
                      ? "bg-gradient-to-r from-purple-500 to-indigo-500"
                      : "bg-zinc-700"
                  }`}
                >
                  <div
                    className={`absolute h-3.5 w-3.5 rounded-full bg-white shadow-lg transition-all duration-300 ${
                      dataAnalysisEnabled
                        ? "translate-x-[18px]"
                        : "translate-x-0.5"
                    }`}
                  />
                </div>
                <Sparkles
                  className={`h-4 w-4 transition-all duration-300 ${
                    dataAnalysisEnabled
                      ? "text-purple-400"
                      : "text-zinc-500 group-hover:text-zinc-400"
                  }`}
                />
                <span
                  className={`text-xs font-semibold transition-all duration-300 ${
                    dataAnalysisEnabled
                      ? "text-purple-200"
                      : "text-zinc-300 group-hover:text-zinc-200"
                  }`}
                >
                  Data Analysis
                </span>
              </div>
            </button>
          </div>

          <button
            type="submit"
            disabled={disabled || value.trim().length === 0}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 text-white shadow-lg shadow-indigo-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={disabled ? "Streaming" : "Send message"}
          >
            {disabled ? (
              <span className="text-xs font-semibold">…</span>
            ) : (
              <SendHorizonal className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
