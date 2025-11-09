import type {
  DetailedHTMLProps,
  HTMLAttributes,
  ReactNode,
} from "react";
import type { UIMessage } from "ai";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessagePartsProps {
  message: UIMessage;
}

export function isTextPart(
  part: UIMessage["parts"][number]
): part is Extract<UIMessage["parts"][number], { type: "text"; text: string }> {
  return (
    part.type === "text" &&
    "text" in part &&
    typeof (part as { text?: unknown }).text === "string"
  );
}

export function MessageParts({ message }: MessagePartsProps) {
  const textParts = message.parts.filter(isTextPart);

  if (textParts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 text-sm leading-relaxed text-zinc-200">
      {textParts.map((part, index) => (
        <ReactMarkdown
          key={index}
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {part.text}
        </ReactMarkdown>
      ))}
    </div>
  );
}

export const markdownComponents: Components = {
  h1: ({ node, ...props }) => (
    <h2 className="text-xl font-semibold text-indigo-100" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h3 className="text-lg font-semibold text-indigo-100/90" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h4 className="text-base font-semibold text-indigo-100/80" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="leading-relaxed text-indigo-100/90" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul
      className="list-disc list-inside space-y-1 text-indigo-100/90"
      {...props}
    />
  ),
  ol: ({ node, ...props }) => (
    <ol
      className="list-decimal list-inside space-y-1 text-indigo-100/90"
      {...props}
    />
  ),
  li: ({ node, ...props }) => (
    <li className="leading-relaxed text-indigo-100/90" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong className="font-semibold text-indigo-50" {...props} />
  ),
  em: ({ node, ...props }) => (
    <em className="italic text-indigo-100/90" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      className="border-l-2 border-indigo-500/40 pl-4 text-indigo-100/80"
      {...props}
    />
  ),
  code: ({ inline, children, ...props }: MarkdownCodeProps) => {
    if (inline) {
      return (
        <code
          className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[0.9em] text-indigo-100"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <pre className="overflow-auto rounded-2xl bg-zinc-950/80 p-4">
        <code className="block font-mono text-xs text-indigo-100" {...props}>
          {children}
        </code>
      </pre>
    );
  },
  table: ({ node, ...props }) => (
    <div className="overflow-hidden rounded-xl border border-indigo-500/20">
      <table
        className="w-full border-collapse text-sm text-indigo-100"
        {...props}
      />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-indigo-500/20" {...props} />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="divide-y divide-indigo-500/20" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th
      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200"
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td className="px-3 py-2 text-sm text-indigo-100/90" {...props} />
  ),
  a: ({ node, ...props }) => (
    <a
      className="text-indigo-300 underline decoration-indigo-500/60 underline-offset-2 transition hover:text-indigo-100"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
};

type MarkdownCodeProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  inline?: boolean;
  children?: ReactNode;
};
