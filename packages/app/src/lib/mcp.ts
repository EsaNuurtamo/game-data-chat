import {
  experimental_createMCPClient,
  type experimental_MCPClient
} from "@ai-sdk/mcp";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

export function getMcpBaseUrl(): string {
  const base = process.env.MCP_BASE_URL ?? DEFAULT_BASE_URL;
  return base.replace(/\/+$/, "");
}

export async function withMcpClient<T>(
  callback: (client: experimental_MCPClient) => Promise<T>
): Promise<T> {
  const client = await experimental_createMCPClient({
    transport: {
      type: "http",
      url: `${getMcpBaseUrl()}/mcp`
    }
  });

  try {
    return await callback(client);
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
