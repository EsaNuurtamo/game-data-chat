import type { ExecutionContext } from "@cloudflare/workers-types";
import { DATASET_VERSION } from "@game-data/db";

import { GameDataAgent } from "./agent";
import { isRequestAuthorized } from "./auth";
import { VERSION } from "./constants";
import type { WorkerEnv } from "./types";

export { GameDataAgent } from "./agent";

const protectedPaths = new Set(["/mcp", "/sse", "/sse/message"]);

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    console.log("request", request.headers.get("authorization"));

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

    return new Response("Not Found", { status: 404 });
  },
};
