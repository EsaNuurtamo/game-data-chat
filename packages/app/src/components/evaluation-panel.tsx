export type EvalStatus = "idle" | "running" | "done" | "error";

interface EvaluationPanelProps {
  status: EvalStatus;
  output: string;
  disabled: boolean;
  onRun: () => void | Promise<void>;
}

export function EvaluationPanel({ status, output, disabled, onRun }: EvaluationPanelProps) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Built-in Evaluation</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Runs a deterministic sample query and surfaces the agent&apos;s response so you can verify
            the reported metrics against RAWG data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRun()}
          disabled={disabled || status === "running"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {status === "running" ? "Running…" : "Run Sample Query"}
        </button>
      </div>
      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-800">
        {status === "idle" && "Click “Run Sample Query” to generate evaluation output."}
        {status === "running" && "Fetching evaluation output…"}
        {status === "error" && (
          <p className="text-red-600">
            {output || "Sample evaluation failed. Check the console for details."}
          </p>
        )}
        {status === "done" && (
          <pre className="whitespace-pre-wrap text-xs leading-relaxed">{output}</pre>
        )}
      </div>
    </section>
  );
}
