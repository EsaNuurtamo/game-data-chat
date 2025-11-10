import type {
  DurableObjectNamespace,
  KVNamespace,
} from "@cloudflare/workers-types";
import type { Sandbox } from "@cloudflare/sandbox";

export type EnvBindings = {
  MCP_API_KEYS?: string;
  RAWG_API_KEY: string;
  CODE_SANDBOX_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  RAWG_CACHE: KVNamespace;
  Sandbox?: DurableObjectNamespace<Sandbox<unknown>>;
};

export type WorkerEnv = EnvBindings & {
  MCP_OBJECT: DurableObjectNamespace;
};
