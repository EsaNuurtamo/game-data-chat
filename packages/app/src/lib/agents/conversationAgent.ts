import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  convertToModelMessages,
  UI_MESSAGE_STREAM_HEADERS,
  type TextStreamPart,
  type ToolSet,
  type UIMessageStreamWriter,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { createMcpClient } from "@/lib/mcp";
import type { AgentUIMessage, ThinkingStep } from "@/types/Agent";

const SYSTEM_PROMPT = `You are an analytics assistant that must use the provided tools to answer questions about video games.
Explain your calculations clearly, but do not expose internal dataset identifiers in your response.
If tool calls fail, report the failure.
Sometimes you will be asked about the whole family of consoles like all playstations or xbox games use parent platform for that.
Format every user-facing response in well-structured Markdown, using headings, bullet lists, tables, and code blocks when appropriate.

Use \`fetch_game_data\` to gather RAWG results before running numbers. When you need to compute statistics, call \`execute_calculation\` with \`{ "datasetId": "...", "query": "<JSON Query expression>" }\`. Queries use https://jsonquerylang.org syntax. Helpful examples:
- Count games per genre:
  \`\`\`
  .items
    | unnest(.genres)
    | groupBy(.genres.name)
    | mapValues(size())
  \`\`\`
- Average rating per platform:
  \`\`\`
  .items
    | unnest(.platforms)
    | groupBy(.platforms.platform.name)
    | mapValues(map(.rating) | average())
  \`\`\`
- Games with rating > 4:
  \`\`\`
  .items
    | filter(.rating > 4)
  \`\`\`
- Top 5 games by rating:
  \`\`\`
  .items
    | sort(.rating, "desc")
    | limit(5)
  \`\`\`
`;

type AgentTextStreamPart = TextStreamPart<ToolSet>;

interface ConversationAgentOptions {
  messages: AgentUIMessage[];
  apiKey: string;
  modelName?: string;
}

export async function createConversationAgentResponse({
  messages,
  apiKey,
  modelName = "gpt-5-mini",
}: ConversationAgentOptions): Promise<Response> {
  const openai = createOpenAI({ apiKey });
  const client = await createMcpClient();

  try {
    const tools = await client.tools();
    const closeClient = async () => {
      try {
        await client.close();
      } catch (closeError) {
        console.warn("Failed to close MCP client", closeError);
      }
    };

    const result = streamText({
      model: openai.responses(modelName),
      system: SYSTEM_PROMPT,
      messages: convertToModelMessages(messages),
      tools,
      providerOptions: {
        openai: {
          reasoningSummary: "auto",
          reasoning_effort: "minimal",
          textVerbosity: "low",
        },
      },
      maxRetries: 2,
      stopWhen: stepCountIs(12),
      onFinish: closeClient,
      onError: async () => {
        await closeClient();
      },
      onAbort: async () => {
        await closeClient();
      },
    });

    const runId = crypto.randomUUID();

    const stream = createUIMessageStream<AgentUIMessage>({
      originalMessages: messages,
      onError: (error) => {
        console.error("Agent stream error", error);
        return "Agent execution failed.";
      },
      execute: async ({ writer }) => {
        writer.write({
          type: "data-thinking-reset",
          id: runId,
          data: { runId },
        });

        writer.merge(
          result.toUIMessageStream<AgentUIMessage>({
            originalMessages: messages,
          })
        );

        try {
          await forwardThinkingSteps({
            stream: result.fullStream,
            writer,
            runId,
            now: () => new Date(),
          });
        } catch (thinkingError) {
          const failureStep: ThinkingStep = {
            id: `step-error-${runId}`,
            kind: "thought",
            label: "Streaming failed",
            status: "failed",
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            error:
              thinkingError instanceof Error
                ? thinkingError.message
                : String(thinkingError ?? "Unknown streaming failure"),
          };

          writer.write({
            type: "data-thinking-step",
            id: failureStep.id,
            data: failureStep,
          });

          throw thinkingError;
        }
      },
    });

    return createUIMessageStreamResponse({
      status: 200,
      headers: UI_MESSAGE_STREAM_HEADERS,
      stream,
    });
  } catch (error) {
    await client
      .close()
      .catch((closeError) =>
        console.warn("Failed to close MCP client after error", closeError)
      );
    throw error;
  }
}

async function forwardThinkingSteps({
  stream,
  writer,
  runId,
  now,
}: {
  stream: AsyncIterable<AgentTextStreamPart>;
  writer: UIMessageStreamWriter<AgentUIMessage>;
  runId: string;
  now: () => Date;
}) {
  const steps = new Map<string, ThinkingStep>();

  const createStep = (
    overrides: Partial<ThinkingStep> & { id: string }
  ): ThinkingStep => ({
    id: overrides.id,
    kind: overrides.kind ?? "thought",
    label: overrides.label ?? "Agent step",
    status: overrides.status ?? "in-progress",
    startedAt: overrides.startedAt ?? now().toISOString(),
    completedAt: overrides.completedAt,
    runId,
    body: overrides.body,
    tool: overrides.tool,
    input: overrides.input,
    output: overrides.output,
    error: overrides.error,
    metadata: overrides.metadata,
  });

  const publish = (step: ThinkingStep) => {
    steps.set(step.id, step);
    writer.write({
      type: "data-thinking-step",
      id: step.id,
      data: step,
    });
  };

  const ensureStep = (
    id: string,
    defaults?: Partial<ThinkingStep>
  ): ThinkingStep => {
    const existing = steps.get(id);
    if (existing) {
      return existing;
    }
    const created = createStep({ id, ...defaults });
    publish(created);
    return created;
  };

  const updateStep = (
    id: string,
    updater: (current: ThinkingStep) => ThinkingStep,
    defaults?: Partial<ThinkingStep>
  ) => {
    const base = steps.get(id) ?? createStep({ id, ...defaults });
    const updated = updater({ ...base });
    publish(updated);
    return updated;
  };

  for await (const part of stream) {
    if (!part) continue;

    if (process.env.NODE_ENV !== "production") {
      try {
        console.debug("[agent] stream part", {
          type: part.type,
          id: "id" in part ? part.id : undefined,
          toolCallId: "toolCallId" in part ? part.toolCallId : undefined,
          toolName: "toolName" in part ? part.toolName : undefined,
          text:
            part.type === "reasoning-delta"
              ? (part.text ?? "").slice(0, 80)
              : undefined,
        });
      } catch (logError) {
        console.warn("[agent] failed to log stream part", logError);
      }
    }

    switch (part.type) {
      case "reasoning-start": {
        ensureStep(part.id, {
          kind: "thought",
          label: "Analyzing the request",
        });
        break;
      }
      case "reasoning-delta": {
        updateStep(
          part.id,
          (step) => {
            const nextBody = `${step.body ?? ""}${part.text}`;
            return {
              ...step,
              body: nextBody,
              label: deriveLabelFromBody(nextBody, step.label),
            };
          },
          {
            kind: "thought",
            label: "Analyzing the request",
          }
        );
        break;
      }
      case "reasoning-end": {
        updateStep(
          part.id,
          (step) => ({
            ...step,
            status: "succeeded",
            completedAt: step.completedAt ?? now().toISOString(),
          }),
          {
            kind: "thought",
            label: "Analyzing the request",
          }
        );
        break;
      }
      case "tool-call": {
        const nextLabel = deriveToolCallLabel(part.toolName, part.input);
        updateStep(
          part.toolCallId,
          (step) => ({
            ...step,
            kind: "tool",
            label: nextLabel,
            status: "in-progress",
            input: part.input,
            tool: {
              name: formatToolName(part.toolName),
              callId: part.toolCallId,
            },
          }),
          {
            kind: "tool",
            label: nextLabel,
            tool: {
              name: formatToolName(part.toolName),
              callId: part.toolCallId,
            },
            input: part.input,
          }
        );
        break;
      }
      case "tool-result": {
        const errorMessage = extractErrorMessage(part.output);
        const resultLabel = deriveToolResultLabel(
          steps.get(part.toolCallId),
          part.output,
          errorMessage
        );
        updateStep(
          part.toolCallId,
          (step) => ({
            ...step,
            output: part.output,
            status: errorMessage ? "failed" : "succeeded",
            completedAt: now().toISOString(),
            label: resultLabel,
            error: errorMessage ?? step.error,
          }),
          {
            kind: "tool",
            label: resultLabel,
            error: errorMessage ?? undefined,
          }
        );
        break;
      }
      case "tool-input-start":
      case "tool-input-delta":
      case "tool-input-end":
        break;
      case "tool-error": {
        updateStep(
          part.toolCallId,
          (step) => ({
            ...step,
            error:
              typeof part.error === "string"
                ? part.error
                : JSON.stringify(part.error),
            status: "failed",
            completedAt: now().toISOString(),
            label: `${formatToolName(step.tool?.name)} failed`,
          }),
          {
            kind: "tool",
            label: "Tool result error",
          }
        );
        break;
      }
      default:
        break;
    }
  }
}

function deriveLabelFromBody(body: string, fallback: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    return fallback;
  }
  const firstLine = trimmed.split(/\r?\n/)[0];
  const cleaned = "Reasoning: " + cleanMarkdownSnippets(firstLine);
  if (cleaned.length <= 90) {
    return cleaned;
  }
  return `${cleaned.slice(0, 87)}…`;
}

function formatToolName(name?: string | null) {
  if (!name) return "tool";
  const trimmed = name.trim();
  if (!trimmed) return "tool";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function cleanMarkdownSnippets(input: string): string {
  let value = input.trim();
  value = value.replace(/^#+\s*/, "");
  value = value.replace(/^[-*•]\s+/, "");
  value = value.replace(/^\d+\.\s+/, "");
  value = value.replace(/^[`*_~]+/, "");
  value = value.replace(/[`*_~]+$/, "");
  value = value.replace(/\s{2,}/g, " ");
  return value.trim();
}

function deriveToolCallLabel(
  toolName?: string | null,
  input?: unknown
): string {
  const formattedName = formatToolName(toolName);
  if (formattedName.toLowerCase() === "fetch_game_data") {
    const filters = extractFiltersFromInput(input);
    const summary = summarizeFilters(filters);
    return summary ? `Fetching ${summary}` : "Fetching game data";
  }
  if (formattedName.toLowerCase() === "execute_calculation") {
    const summary = summarizeCalculationInput(input);
    return summary ? `Calculating ${summary}` : "Calculating results";
  }
  return `Calling ${formattedName}`;
}

function deriveToolResultLabel(
  step: ThinkingStep | undefined,
  output: unknown,
  errorMessage: string | null
): string {
  if (errorMessage) {
    return step?.tool?.name
      ? `${formatToolName(step.tool.name)} returned an error`
      : "Tool returned an error";
  }
  const toolName = step?.tool?.name ?? "tool";
  if (toolName.toLowerCase() === "fetch_game_data") {
    const filters = step?.metadata?.filters ?? extractFiltersFromOutput(output);
    const summary = summarizeFilters(filters);
    return summary ? `Fetched ${summary}` : "Fetched game data";
  }
  if (toolName.toLowerCase() === "execute_calculation") {
    const summary =
      summarizeCalculationOutput(output) ??
      summarizeCalculationInput(step?.input);
    return summary ? `Calculated ${summary}` : "Calculation complete";
  }
  return `Received ${formatToolName(toolName)} result`;
}

type FiltersSummary = {
  platforms?: string[];
  releasedFrom?: string | null;
  releasedTo?: string | null;
  pageSize?: number;
};

function extractFiltersFromInput(input: unknown): FiltersSummary | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const candidate = input as { filters?: unknown };
  const filters = candidate.filters;
  if (!filters || typeof filters !== "object") {
    return null;
  }
  const record = filters as Record<string, unknown>;
  return {
    platforms: Array.isArray(record.platforms)
      ? record.platforms
          .map((value) =>
            typeof value === "string" ? humanizeIdentifier(value) : null
          )
          .filter((value): value is string => Boolean(value))
      : undefined,
    releasedFrom:
      typeof record.releasedFrom === "string" ? record.releasedFrom : null,
    releasedTo:
      typeof record.releasedTo === "string" ? record.releasedTo : null,
    pageSize:
      typeof record.pageSize === "number"
        ? Math.max(record.pageSize, 0)
        : undefined,
  };
}

function extractFiltersFromOutput(output: unknown): FiltersSummary | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const candidate = output as { filters?: unknown };
  const filters = candidate.filters;
  if (!filters || typeof filters !== "object") {
    return null;
  }
  const record = filters as Record<string, unknown>;
  return {
    platforms: Array.isArray(record.platforms)
      ? record.platforms
          .map((value) =>
            typeof value === "string" ? humanizeIdentifier(value) : null
          )
          .filter((value): value is string => Boolean(value))
      : undefined,
    releasedFrom:
      typeof record.releasedFrom === "string" ? record.releasedFrom : null,
    releasedTo:
      typeof record.releasedTo === "string" ? record.releasedTo : null,
    pageSize:
      typeof record.pageSize === "number"
        ? Math.max(record.pageSize, 0)
        : undefined,
  };
}

function summarizeFilters(filters: FiltersSummary | null): string | null {
  if (!filters) {
    return null;
  }
  const parts: string[] = [];
  if (filters.platforms && filters.platforms.length > 0) {
    const [first, ...rest] = filters.platforms;
    parts.push(
      filters.platforms.length > 1 ? `${first} +${rest.length}` : `${first}`
    );
  }
  if (filters.releasedFrom || filters.releasedTo) {
    const from = filters.releasedFrom
      ? formatDateForLabel(filters.releasedFrom)
      : null;
    const to = filters.releasedTo
      ? formatDateForLabel(filters.releasedTo)
      : null;
    if (from && to) {
      parts.push(`${from} → ${to}`);
    } else if (from) {
      parts.push(`after ${from}`);
    } else if (to) {
      parts.push(`before ${to}`);
    }
  }
  if (filters.pageSize && filters.pageSize !== 40) {
    parts.push(`${filters.pageSize} per page`);
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join(", ");
}

function summarizeCalculationInput(input: unknown): string | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as Record<string, unknown>;
  const query =
    typeof record.query === "string" ? record.query : null;
  return query ? formatQuerySnippet(query) : null;
}

function summarizeCalculationOutput(output: unknown): string | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const record = output as Record<string, unknown>;
  const query =
    typeof record.query === "string" ? record.query : null;
  const itemsProcessed = record.itemsProcessed;
  const parts: string[] = [];
  const querySnippet = query ? formatQuerySnippet(query) : null;
  if (querySnippet) {
    parts.push(querySnippet);
  }
  if (typeof itemsProcessed === "number") {
    parts.push(`${itemsProcessed} items`);
  }
  if (parts.length === 0 && "value" in record) {
    const summary = summarizeUnknownValue(record.value);
    if (summary) {
      parts.push(summary);
    }
  }
  return parts.length > 0 ? parts.join(" | ") : null;
}

function formatQuerySnippet(query: string): string | null {
  const singleLine = query
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!singleLine) {
    return null;
  }
  return singleLine.length > 90
    ? `${singleLine.slice(0, 87)}…`
    : singleLine;
}

function summarizeUnknownValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number") {
    return `result ${String(value)}`;
  }
  try {
    const serialized = JSON.stringify(value);
    if (!serialized) {
      return null;
    }
    return serialized.length > 60
      ? `${serialized.slice(0, 57)}…`
      : serialized;
  } catch {
    return null;
  }
}

function humanizeIdentifier(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateForLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function extractErrorMessage(output: unknown): string | null {
  if (!output || typeof output !== "object") {
    return null;
  }

  const candidate = output as {
    isError?: unknown;
    content?: unknown;
    message?: unknown;
    error?: unknown;
  };

  const isError = Boolean(candidate.isError);
  if (!isError) {
    return null;
  }

  if (typeof candidate.message === "string" && candidate.message.trim()) {
    return candidate.message.trim();
  }

  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error.trim();
  }

  if (Array.isArray(candidate.content)) {
    const text = candidate.content
      .map((item) => {
        if (item && typeof item === "object" && "text" in item) {
          const maybeText = (item as { text?: unknown }).text;
          return typeof maybeText === "string" ? maybeText : "";
        }
        return "";
      })
      .filter((value) => value.trim().length > 0)
      .join("\n");
    if (text.trim().length > 0) {
      return text.trim();
    }
  }

  return null;
}
