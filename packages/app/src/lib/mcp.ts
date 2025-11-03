import {
  experimental_createMCPClient,
  type experimental_MCPClient,
} from "@ai-sdk/mcp";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

export function getMcpBaseUrl(): string {
  const base = process.env.MCP_BASE_URL ?? DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export async function withMcpClient<T>(
  callback: (client: experimental_MCPClient) => Promise<T>
): Promise<T> {
  const apiKey = process.env.MCP_API_KEY?.trim();
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

  const baseUrl = getMcpBaseUrl();
  const supportsHttp = false; // Cloudflare MCP server currently only supports SSE transport.
  console.log("baseUrl", baseUrl);
  console.log("headers", headers);
  const client = await experimental_createMCPClient({
    transport: supportsHttp
      ? {
          type: "http" as const,
          url: `${baseUrl}/mcp`,
          headers,
        }
      : {
          type: "sse" as const,
          url: `${baseUrl}/sse`,
          headers,
        },
  });

  try {
    return await callback(client);
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
