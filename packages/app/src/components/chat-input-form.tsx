import type { FormEvent } from "react";

interface ChatInputFormProps {
  value: string;
  placeholder: string;
  disabled: boolean;
  canStop: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onStop: () => void;
}

export function ChatInputForm({
  value,
  placeholder,
  disabled,
  canStop,
  onChange,
  onSubmit,
  onStop
}: ChatInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-zinc-700/60 bg-zinc-900/70 p-4 shadow-lg shadow-black/30 backdrop-blur">
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-400" htmlFor="prompt">
        Ask the agent
      </label>
      <textarea
        id="prompt"
        name="prompt"
        className="h-28 w-full resize-none rounded-xl border border-transparent bg-zinc-800/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onStop}
          disabled={!canStop}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
        >
          Stop
        </button>
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          className="rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-sky-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {disabled ? "Streaming…" : "Send"}
        </button>
      </div>
    </form>
  );
}
