import {
  experimental_createMCPClient,
  type experimental_MCPClient,
} from "@ai-sdk/mcp";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

function readEnv(key: "MCP_BASE_URL" | "MCP_API_KEY"): string | undefined {
  const nodeValue =
    typeof process !== "undefined" ? process.env?.[key]?.trim() : undefined;
  if (nodeValue) {
    return nodeValue;
  }

  try {
    const context = getCloudflareContext();
    const envBindings = context.env as Record<string, unknown> | undefined;
    const binding = envBindings?.[key];
    if (typeof binding === "string" && binding.trim().length > 0) {
      return binding.trim();
    }
  } catch {
    // Ignore errors when not running inside a Cloudflare worker request.
  }

  return undefined;
}

export function getMcpBaseUrl(): string {
  const base = readEnv("MCP_BASE_URL") ?? DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export async function createMcpClient(): Promise<experimental_MCPClient> {
  const apiKey = readEnv("MCP_API_KEY");
  let client: experimental_MCPClient | undefined;
  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
    };

    const baseUrl = getMcpBaseUrl();
    console.log("baseUrl", baseUrl);
    console.log("headers", headers);

    client = await experimental_createMCPClient({
      transport: {
        type: "sse",
        url: `${baseUrl}/sse`,
        headers,
      },
      onUncaughtError: (error: unknown) => {
        console.error("Uncaught error", error);
        throw error;
      },
    });
    return client;
  } catch (error) {
    console.error("Error creating MCP client", error);
    await client?.close().catch(() => undefined);
    throw error;
  }
}
