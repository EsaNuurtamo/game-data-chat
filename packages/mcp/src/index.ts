import type { ExecutionContext } from "@cloudflare/workers-types";
import { DATASET_VERSION, readDataset } from "@game-data/db";
import { GameDataAgent } from "./ai/mcp-agent";
import { isRequestAuthorized } from "./auth";
import { VERSION } from "./helpers/constants";
import type { WorkerEnv } from "./env";

export { GameDataAgent } from "./ai/mcp-agent";
export { Sandbox } from "@cloudflare/sandbox";

const protectedPaths = new Set(["/mcp", "/sse", "/sse/message"]);

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      protectedPaths.has(url.pathname) &&
      !isRequestAuthorized(request, env)
    ) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": 'Bearer realm="game-data-chat-mcp"',
        },
      });
    }

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return GameDataAgent.serveSSE("/sse").fetch(request, env, ctx);
    }

    if (url.pathname === "/mcp") {
      return GameDataAgent.serve("/mcp").fetch(request, env, ctx);
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          service: "game-data-chat-mcp",
          version: VERSION,
          datasetVersion: DATASET_VERSION,
        }),
        {
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (url.pathname.startsWith("/datasets/")) {
      const datasetId = decodeURIComponent(
        url.pathname.replace(/^\/datasets\//, "").trim()
      );
      if (!datasetId) {
        return new Response(
          JSON.stringify({ error: "Dataset id is required" }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          }
        );
      }

      try {
        const dataset = await readDataset(env.RAWG_CACHE, datasetId);
        if (!dataset) {
          return new Response(JSON.stringify({ error: "Dataset not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify(dataset), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        });
      } catch (error) {
        console.error("Failed to read dataset", datasetId, error);
        return new Response(
          JSON.stringify({ error: "Failed to read dataset" }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
