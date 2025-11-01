import type { UIMessage } from "ai";

interface MessagePartsProps {
  message: UIMessage;
}

export function MessageParts({ message }: MessagePartsProps) {
  return (
    <div className="space-y-2 text-sm text-zinc-800">
      {message.parts.map((part, index) => {
        if (part.type === "text") {
          return <p key={index}>{part.text}</p>;
        }

        if (part.type === "reasoning") {
          return (
            <p key={index} className="text-xs italic text-zinc-500">
              {part.text}
            </p>
          );
        }

        if (part.type.startsWith("tool-")) {
          const toolName =
            "toolName" in part && typeof part.toolName === "string" ? part.toolName : "unknown";
          const state = "state" in part && typeof part.state === "string" ? part.state : undefined;
          const label = part.type === "tool-call" ? "Tool Call" : "Tool";
          return (
            <div
              key={index}
              className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700"
            >
              <div className="font-semibold uppercase tracking-wide text-zinc-500">
                {label} · {toolName}
              </div>
              {state ? (
                <div className="text-[0.7rem] text-zinc-600">
                  {state === "output-error"
                    ? "Error"
                    : state === "output-available"
                      ? "Completed"
                      : state}
                </div>
              ) : null}
            </div>
          );
        }

        if (part.type.startsWith("data-")) {
          return (
            <div
              key={index}
              className="rounded-md bg-zinc-50 px-3 py-2 text-[0.7rem] text-zinc-500"
            >
              Data · {part.type.replace("data-", "")}
            </div>
          );
        }

        const label = part.type;

        return (
          <pre
            key={index}
            className="overflow-x-auto rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700"
          >
            <strong className="block text-[0.65rem] uppercase tracking-wide text-zinc-500">
              {label}
            </strong>
            {JSON.stringify(part, null, 2)}
          </pre>
        );
      })}
    </div>
  );
}
