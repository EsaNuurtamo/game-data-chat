import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  stepCountIs,
  convertToModelMessages,
  UI_MESSAGE_STREAM_HEADERS,
  Tool,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";

import { createMcpClient } from "@/lib/mcp";
import type { AgentUIMessage, ThinkingStep } from "@/types/Agent";
import { isAbortError } from "@/utils/errors";

import { SYSTEM_PROMPT } from "./systemPrompt";
import { forwardThinkingSteps } from "./thinkingSteps";

interface ConversationAgentOptions {
  messages: AgentUIMessage[];
  apiKey: string;
  modelName?: string;
  dataAnalysisEnabled?: boolean;
  signal?: AbortSignal;
}

export async function createConversationAgentResponse({
  messages,
  apiKey,
  modelName = "gpt-5-mini",
  dataAnalysisEnabled = false,
  signal,
}: ConversationAgentOptions): Promise<Response> {
  const openai = createOpenAI({ apiKey });
  const client = await createMcpClient();

  try {
    const tools = selectToolsForRun({
      tools: await client.tools(),
      dataAnalysisEnabled,
    });
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
          reasoning_effort: "low",
          textVerbosity: "low",
        },
      },
      maxRetries: 2,
      abortSignal: signal,
      stopWhen: stepCountIs(10),
      onFinish: closeClient,
      onError: closeClient,
      onAbort: closeClient,
    });

    const runId = crypto.randomUUID();

    const stream = createUIMessageStream<AgentUIMessage>({
      originalMessages: messages,
      onError: (error) => {
        if (isAbortError(error)) {
          return "Agent run cancelled.";
        }
        console.error("Agent stream error", error);
        return "Agent execution failed.";
      },
      execute: async ({ writer }) => {
        if (signal?.aborted) {
          return;
        }

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

        const abortHandler = () => {
          writer.write({
            type: "data-thinking-reset",
            id: runId,
            data: { runId },
          });
        };

        signal?.addEventListener("abort", abortHandler);

        try {
          await forwardThinkingSteps({
            stream: result.fullStream,
            writer,
            runId,
            now: () => new Date(),
          });
        } catch (thinkingError) {
          if (isAbortError(thinkingError)) {
            return;
          }

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
        } finally {
          signal?.removeEventListener("abort", abortHandler);
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

function selectToolsForRun({
  tools,
  dataAnalysisEnabled,
}: {
  tools: Record<string, Tool>;
  dataAnalysisEnabled: boolean;
}): Record<string, Tool> {
  const allowed = new Set([
    "fetch_game_data",
    dataAnalysisEnabled ? "data_analysis" : "execute_calculation",
  ]);

  Object.keys(tools).forEach((toolName) => {
    if (!allowed.has(toolName)) {
      delete tools[toolName];
    }
  });

  return tools;
}
