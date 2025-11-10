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
import {
  dataAnalysisOutputSchema,
  dataAnalysisToolArgsShape,
  handleDataAnalysis,
} from "./tools/data-analysis";

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
      [
        "Run a JSON Query expression against a cached RAWG dataset.",
        "Pass { datasetId, query } where query uses https://jsonquerylang.org syntax.",
        "Examples:",
        "- Count average rating: `.items | filter(.rating > 0) | map(.rating) | average()` // filter away the one with no rating (0 value)",
        "- Count games per genre: `.items | unnest(.genres) | groupBy(.genres.name) | mapValues(size())`",
        "- Average rating per platform: `.items | filter(.rating > 0) | unnest(.platforms) | groupBy(.platforms.platform.name) | mapValues(map(.rating) | average())`",
        "- Filter high-rated games: `.items | filter(.rating > 4)`",
        '- Top 5 games by rating: `.items | sort(.rating, "desc") | limit(5)`',
      ].join(" "),
      executeToolArgsShape,
      async (args) => {
        const structured = executeOutputSchema.parse(
          await handleExecuteCalculation(
            {
              datasetId: args.datasetId,
              query: args.query,
              fresh: args.fresh ?? false,
            },
            this.bindings
          )
        );

        const queryPreview =
          structured.query.length > 120
            ? `${structured.query.slice(0, 117)}…`
            : structured.query;

        return {
          content: [
            {
              type: "text",
              text: [
                `datasetId=${structured.datasetId}`,
                `query=${queryPreview}`,
                `itemsProcessed=${structured.itemsProcessed}`,
                `value=${JSON.stringify(structured.value)}`,
              ].join(" | "),
            },
          ],
          structuredContent: structured,
        };
      }
    );

    this.server.tool(
      "data_analysis",
      [
        "Run Python-based data analysis on a cached RAWG dataset using AI-generated code.",
        "This tool generates Python code to answer your question, executes it in a secure sandbox, and returns the results.",
        "Pass { datasetId, question } where question describes what analysis you want to perform.",
        "The tool will automatically generate Python code using pandas, numpy, and other data analysis libraries.",
        "Optional: contextId for resuming previous analysis sessions, fresh to force dataset refresh, timeout to customize execution timeout (default 60s).",
      ].join(" "),
      dataAnalysisToolArgsShape,
      async (args) => {
        const structured = dataAnalysisOutputSchema.parse(
          await handleDataAnalysis(
            {
              datasetId: args.datasetId,
              question: args.question,
              contextId: args.contextId,
              fresh: args.fresh ?? false,
              timeout: args.timeout,
            },
            this.bindings
          )
        );

        const questionPreview =
          structured.question.length > 80
            ? `${structured.question.slice(0, 77)}…`
            : structured.question;

        return {
          content: [
            {
              type: "text",
              text: [
                `datasetId=${structured.datasetId}`,
                `question=${questionPreview}`,
                `success=${structured.success}`,
                `contextId=${structured.contextId}`,
                structured.success
                  ? `result=${JSON.stringify(structured.result)}`
                  : `error=${structured.error?.value || "Unknown error"}`,
              ].join(" | "),
            },
          ],
          structuredContent: structured,
        };
      }
    );
  }
}
