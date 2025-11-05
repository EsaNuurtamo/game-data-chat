interface SuggestionChipsProps {
  prompts: string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
  className?: string;
}

export function SuggestionChips({
  prompts,
  disabled,
  onSelect,
  className,
}: SuggestionChipsProps) {
  if (prompts.length === 0) {
    return null;
  }

  // Ensure we always render an even grid by pairing prompts.
  const items = prompts.slice();
  if (items.length % 2 !== 0) {
    items.push("");
  }

  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
        className ?? ""
      }`}
    >
      {items.map((prompt, index) => (
        <button
          key={`${prompt}-${index}`}
          type="button"
          onClick={() => prompt && onSelect(prompt)}
          className="h-24 w-full rounded-3xl border border-zinc-800/60 bg-zinc-900/80 px-5 py-3 text-left text-sm leading-relaxed text-zinc-100 shadow-lg shadow-black/20 transition hover:border-indigo-500/60 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !prompt}
        >
          {prompt ? (
            <span className="line-clamp-3">{prompt}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
