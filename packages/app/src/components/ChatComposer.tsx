import { type FormEvent } from "react";

import { ChatInputForm } from "./ChatInputForm";
import { useDataAnalysisStore } from "@/state/data-analysis-store";

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
  const dataAnalysisEnabled = useDataAnalysisStore((state) => state.enabled);
  const toggleDataAnalysis = useDataAnalysisStore((state) => state.toggle);

  return (
    <ChatInputForm
      value={value}
      placeholder="Ask for trends, comparisons, and insights about game data…"
      disabled={Boolean(isStreaming)}
      canStop={Boolean(isStreaming)}
      dataAnalysisEnabled={dataAnalysisEnabled}
      onToggleDataAnalysis={toggleDataAnalysis}
      onChange={onChange}
      onSubmit={onSubmit}
      onStop={onStop}
    />
  );
}
