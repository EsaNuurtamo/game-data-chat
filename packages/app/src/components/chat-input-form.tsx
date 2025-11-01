import type { FormEvent } from "react";

interface ChatInputFormProps {
  value: string;
  placeholder: string;
  disabled: boolean;
  canCancel: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  onCancel: () => void;
  onUseSample: () => void;
}

export function ChatInputForm({
  value,
  placeholder,
  disabled,
  canCancel,
  onChange,
  onSubmit,
  onCancel,
  onUseSample
}: ChatInputFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-700" htmlFor="prompt">
        Ask a question
      </label>
      <textarea
        id="prompt"
        name="prompt"
        className="h-32 w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {disabled ? "Thinking…" : "Run Agent"}
        </button>
        <button
          type="button"
        onClick={onCancel}
        disabled={!canCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          Cancel
        </button>
        <button
          type="button"
          className="rounded-md border border-transparent bg-zinc-200 px-4 py-2 text-sm text-zinc-700 transition hover:bg-zinc-300"
          onClick={onUseSample}
          disabled={disabled}
        >
          Use Sample Prompt
        </button>
      </div>
    </form>
  );
}
