import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { TAG_DESCRIPTIONS, VERSION } from "./constants";
import type { EnvBindings } from "./types";
import {
  fetchOutputSchema,
  fetchToolArgsShape,
  handleFetchGameData,
} from "./tools/fetch-game-data";
import {
  executeOutputSchema,
  executeToolArgsShape,
  handleExecuteCalculation,
} from "./tools/execute-calculation";

export class GameDataAgent extends McpAgent<EnvBindings> {
  server = new McpServer({
    name: "game-data-chat-mcp",
    version: VERSION,
  });

  private get bindings(): EnvBindings {
    return (this as unknown as { env: EnvBindings }).env;
  }

  async init(): Promise<void> {
    const tagSummary = TAG_DESCRIPTIONS.map(
      (tag) => `${tag.slug} – ${tag.description}`
    ).join("; ");

    this.server.tool(
      "fetch_game_data",
      `Retrieve RAWG game metadata with optional filters. Responses are cached in Cloudflare KV. Supported tags: ${tagSummary}.`,
      fetchToolArgsShape,
      async (args) => {
        const structured = fetchOutputSchema.parse(
          await handleFetchGameData(
            { filters: args.filters, force: args.force ?? false },
            this.bindings
          )
        );

        return {
          content: [
            {
              type: "text",
              text: [
                `datasetId=${structured.datasetId}`,
                `cache=${structured.cacheStatus}`,
                `pages=${structured.totalPages}`,
                `items=${structured.totalItems}`,
                `parentPlatforms=${structured.filters.parentPlatforms.join(",") || "none"}`,
                `tags=${structured.filters.tags.join(",") || "none"}`,
              ].join(" | "),
            },
          ],
          structuredContent: structured,
        };
      }
    );

    this.server.tool(
      "execute_calculation",
      "Run numerical aggregations against a cached RAWG dataset.",
      executeToolArgsShape,
      async (args) => {
        const structured = executeOutputSchema.parse(
          await handleExecuteCalculation(
            {
              datasetId: args.datasetId,
              operation: args.operation,
              field: args.field,
              groupBy: args.groupBy,
              fresh: args.fresh ?? false,
            },
            this.bindings
          )
        );

        return {
          content: [
            {
              type: "text",
              text: [
                `datasetId=${structured.datasetId}`,
                `operation=${structured.operation}`,
                `itemsProcessed=${structured.itemsProcessed}`,
                `value=${JSON.stringify(structured.value)}`,
              ].join(" | "),
            },
          ],
          structuredContent: structured,
        };
      }
    );
  }
}
