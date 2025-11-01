import type { UIMessage } from "ai";

interface MessagePartsProps {
  message: UIMessage;
}

function isTextPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "text"; text: string }> {
  return part.type === "text" && "text" in part && typeof (part as { text?: unknown }).text === "string";
}

export function MessageParts({ message }: MessagePartsProps) {
  const textParts = message.parts.filter(isTextPart);

  if (textParts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-200">
      {textParts.map((part, index) => (
        <p key={index}>{part.text}</p>
      ))}
    </div>
  );
}
