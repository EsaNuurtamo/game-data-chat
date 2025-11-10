import { validateUIMessages, type UIMessage } from "ai";

import type { AgentUIMessage } from "@/types/Agent";
import { createConversationAgentResponse } from "@/lib/agents/conversationAgent";

type RequestBody =
  | {
      messages?: AgentUIMessage[];
      prompt?: never;
    }
  | {
      prompt: string;
      messages?: never;
    };

export async function POST(req: Request): Promise<Response> {
  let body: RequestBody;

  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const dataAnalysisEnabled =
    req.headers.get("X-Data-Analysis-Enabled") === "true";
  console.log("dataAnalysisEnabled", dataAnalysisEnabled);

  const parsedMessages = await parseMessages(body);
  if (!parsedMessages.ok) {
    return parsedMessages.response;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    return await createConversationAgentResponse({
      messages: parsedMessages.messages,
      apiKey,
      modelName: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      dataAnalysisEnabled,
      signal: req.signal,
    });
  } catch (error) {
    console.error("Agent invocation failed", error);
    return jsonResponse(
      {
        error: "Agent execution failed",
        details: error instanceof Error ? error.message : String(error ?? ""),
      },
      { status: 500 }
    );
  }
}

async function parseMessages(
  body: RequestBody
): Promise<
  { ok: true; messages: AgentUIMessage[] } | { ok: false; response: Response }
> {
  if (Array.isArray(body.messages)) {
    try {
      return {
        ok: true,
        messages: await validateUIMessages<AgentUIMessage>({
          messages: body.messages as UIMessage[],
        }),
      };
    } catch (error) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Invalid UI messages payload",
            details:
              error instanceof Error ? error.message : String(error ?? ""),
          },
          { status: 400 }
        ),
      };
    }
  }

  if (typeof body.prompt === "string" && body.prompt.trim().length > 0) {
    return {
      ok: true,
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          parts: [
            {
              type: "text",
              text: body.prompt.trim(),
            },
          ],
        },
      ],
    };
  }

  return {
    ok: false,
    response: jsonResponse(
      {
        error:
          "Provide either `messages` (array) or a non-empty `prompt` string.",
      },
      { status: 400 }
    ),
  };
}

function jsonResponse(
  data: unknown,
  init: ResponseInit & { status: number }
): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
