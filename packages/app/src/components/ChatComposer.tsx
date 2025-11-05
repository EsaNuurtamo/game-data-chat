import { type FormEvent } from "react";

import { ChatInputForm } from "./ChatInputForm";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isStreaming?: boolean;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
}: ChatComposerProps) {
  return (
    <ChatInputForm
      value={value}
      placeholder="Ask for trends, comparisons, and insights about game data…"
      disabled={Boolean(isStreaming)}
      canStop={Boolean(isStreaming)}
      onChange={onChange}
      onSubmit={onSubmit}
      onStop={onStop}
    />
  );
}
