import {
  streamText,
  convertToModelMessages,
  validateUIMessages,
  stepCountIs,
  type UIMessage
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { withMcpClient } from "@/lib/mcp";

type RequestBody =
  | {
      messages?: UIMessage[];
      prompt?: never;
    }
  | {
      prompt: string;
      messages?: never;
    };

export async function POST(req: Request): Promise<Response> {
  let messages: UIMessage[];
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "Request body must be valid JSON." }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  if (Array.isArray(body.messages)) {
    try {
      messages = await validateUIMessages({ messages: body.messages });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Invalid UI messages payload",
          details: error instanceof Error ? error.message : String(error ?? "")
        }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }
  } else if (typeof body.prompt === "string" && body.prompt.trim().length > 0) {
    messages = [
      {
        id: crypto.randomUUID(),
        role: "user",
        parts: [
          {
            type: "text",
            text: body.prompt.trim()
          }
        ]
      }
    ];
  } else {
    return new Response(
      JSON.stringify({
        error: "Provide either `messages` (array) or a non-empty `prompt` string."
      }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "OPENAI_API_KEY is not configured"
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const modelName = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = createOpenAI({ apiKey });

  try {
    return await withMcpClient(async (client) => {
      const tools = await client.tools();
      const closeClient = async () => {
        try {
          await client.close();
        } catch (closeError) {
          console.warn("Failed to close MCP client", closeError);
        }
      };

      const result = await streamText({
        model: openai(modelName),
        system:
          "You are an analytics assistant that must use the provided tools to answer questions about video games. Always cite the datasetId you used and explain your calculations. If tool calls fail, report the failure.",
        messages: convertToModelMessages(messages),
        tools,
        maxRetries: 1,
        temperature: 0.3,
        stopWhen: stepCountIs(6),
        onFinish: closeClient,
        onError: async () => {
          await closeClient();
        },
        onAbort: async () => {
          await closeClient();
        }
      });

      return result.toUIMessageStreamResponse({ originalMessages: messages });
    });
  } catch (error) {
    console.error("Agent invocation failed", error);
    return new Response(
      JSON.stringify({
        error: "Agent execution failed",
        details: error instanceof Error ? error.message : String(error ?? "")
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
