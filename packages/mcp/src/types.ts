import type { DurableObjectNamespace, KVNamespace } from "@cloudflare/workers-types";

export type EnvBindings = {
  MCP_API_KEYS?: string;
  RAWG_API_KEY: string;
  RAWG_CACHE: KVNamespace;
};

export type WorkerEnv = EnvBindings & {
  MCP_OBJECT: DurableObjectNamespace;
};
