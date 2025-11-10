import { getSandbox, type Sandbox } from "@cloudflare/sandbox";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { readDataset, shouldRefresh, writeDataset } from "@game-data/db";
import { z } from "zod";

import { generateAnalysisCode } from "../ai/code-generation";
import { fetchAggregateDataset } from "../data/datasets";
import { executeInSandbox } from "../sandbox";
import type { EnvBindings } from "../env";

export const dataAnalysisToolArgsShape = {
  datasetId: z.string(),
  question: z.string().min(1, "Question must be a non-empty string"),
  contextId: z.string().optional(),
  fresh: z.boolean().optional(),
  timeout: z.number().optional(),
} as const;

const dataAnalysisInputSchema = z.object(dataAnalysisToolArgsShape);

export const dataAnalysisOutputSchema = z.object({
  datasetId: z.string(),
  question: z.string(),
  success: z.boolean(),
  contextId: z.string(),
  result: z.unknown(),
  logs: z.array(z.string()),
  code: z.string().optional(),
  explanation: z.string().optional(),
  error: z
    .object({
      name: z.string(),
      value: z.string(),
      traceback: z.string().optional(),
    })
    .optional(),
});

export type DataAnalysisInput = z.infer<typeof dataAnalysisInputSchema>;
export type DataAnalysisOutput = z.infer<typeof dataAnalysisOutputSchema>;

async function writeDatasetToSandbox(
  sandboxNamespace: DurableObjectNamespace<Sandbox<unknown>>,
  datasetId: string,
  rawDatasetJson: any
): Promise<void> {
  const sandboxId = `dataset-${datasetId}`;
  // @ts-expect-error - Type incompatibility between workers-types versions
  const sandbox = getSandbox(sandboxNamespace, sandboxId);
  const dataPath = "/workspace/data.json";

  console.log(
    "[data-analysis] sandbox_write_dataset_start",
    JSON.stringify({
      sandboxId,
      path: dataPath,
      sizeBytes: rawDatasetJson.length,
    })
  );
  const writeStartTime = Date.now();
  await sandbox.writeFile(dataPath, rawDatasetJson);
  const writeDuration = Date.now() - writeStartTime;
  console.log(
    "[data-analysis] sandbox_write_dataset_complete",
    JSON.stringify({
      sandboxId,
      path: dataPath,
      durationMs: writeDuration,
    })
  );
}

async function analyzeDatasetStructure(
  sandboxNamespace: DurableObjectNamespace<Sandbox<unknown>>,
  datasetId: string
): Promise<string> {
  const sandboxId = `dataset-${datasetId}`;
  // @ts-expect-error - Type incompatibility between workers-types versions
  const sandbox = getSandbox(sandboxNamespace, sandboxId);
  const dataPath = "/workspace/data.json";
  const structureSessionId = `structure-${datasetId}`;

  console.log(
    "[data-analysis] sandbox_exec_structure_start",
    JSON.stringify({
      sandboxId,
      sessionId: structureSessionId,
      timeoutMs: 30_000,
    })
  );
  const structureStartTime = Date.now();
  const structureResult = await sandbox.exec(
    `python3 -c "import json; data = json.load(open('${dataPath}')); print(f'Items: {len(data)}'); print(f'Sample keys: {list(data[0].keys())[:5] if data else []}')"`,
    {
      sessionId: structureSessionId,
      timeout: 30_000,
    }
  );
  const structureDuration = Date.now() - structureStartTime;
  console.log(
    "[data-analysis] sandbox_exec_structure_complete",
    JSON.stringify({
      sandboxId,
      sessionId: structureSessionId,
      success: structureResult.success,
      exitCode: structureResult.exitCode,
      durationMs: structureDuration,
      stdoutLength: structureResult.stdout?.length ?? 0,
      stderrLength: structureResult.stderr?.length ?? 0,
    })
  );

  if (!structureResult.success) {
    throw new Error(
      `Failed to analyze dataset structure: ${structureResult.stderr || "Unknown error"}`
    );
  }

  return structureResult.stdout || "";
}

export async function handleDataAnalysis(
  input: DataAnalysisInput,
  env: EnvBindings
): Promise<DataAnalysisOutput> {
  const parsed = dataAnalysisInputSchema.parse(input);

  if (!env.Sandbox) {
    throw new Error(
      "Sandbox is not configured. Sandbox binding is required for data analysis."
    );
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const dataset = await readDataset(env.RAWG_CACHE, parsed.datasetId);

  if (!dataset) {
    throw new Error(
      `Dataset ${parsed.datasetId} not found in cache. Fetch it using fetch_game_data before running analysis.`
    );
  }

  const latestDataset =
    parsed.fresh || shouldRefresh(dataset)
      ? await fetchAggregateDataset(env, dataset.key, dataset.filters)
      : dataset;

  await writeDataset(env.RAWG_CACHE, latestDataset.key, latestDataset);

  const rawDatasetJson = JSON.stringify(latestDataset.items);
  const sampleItem = latestDataset.items[0] || null;

  console.log(
    "[data-analysis] analysis_start",
    JSON.stringify({
      datasetId: parsed.datasetId,
      question: parsed.question.substring(0, 100),
      contextId: parsed.contextId ?? null,
      items: latestDataset.items.length,
      jsonSizeBytes: rawDatasetJson.length,
      hasSampleItem: sampleItem !== null,
    })
  );

  await writeDatasetToSandbox(env.Sandbox, parsed.datasetId, rawDatasetJson);

  const structureInfo = await analyzeDatasetStructure(
    env.Sandbox,
    parsed.datasetId
  );

  const modelName = env.OPENAI_MODEL || "gpt-4o";

  const codeGenStartTime = Date.now();
  const { code, explanation } = await generateAnalysisCode(
    parsed.question,
    sampleItem,
    env.OPENAI_API_KEY,
    modelName
  );
  const codeGenDuration = Date.now() - codeGenStartTime;
  console.log(
    "[data-analysis] code_generation_complete",
    JSON.stringify({
      model: modelName,
      codeLength: code.length,
      hasExplanation: !!explanation,
      durationMs: codeGenDuration,
    })
  );

  const timeout = parsed.timeout ?? 60_000;
  console.log(
    "[data-analysis] sandbox_exec_code_start",
    JSON.stringify({
      datasetId: parsed.datasetId,
      contextId: parsed.contextId ?? null,
      codeLength: code.length,
      timeoutMs: timeout,
    })
  );
  const { contextId: finalContextId, execution } = await executeInSandbox(
    env.Sandbox,
    parsed.datasetId,
    rawDatasetJson,
    code,
    parsed.contextId,
    timeout
  );
  console.log(
    "[data-analysis] sandbox_exec_code_complete",
    JSON.stringify({
      datasetId: parsed.datasetId,
      contextId: finalContextId,
      success: execution.success,
      hasResult: execution.result !== null,
      logsCount: execution.logs.length,
      hasError: !!execution.error,
    })
  );

  const result: DataAnalysisOutput = {
    datasetId: parsed.datasetId,
    question: parsed.question,
    success: execution.success,
    contextId: finalContextId,
    result: execution.result,
    logs: execution.logs,
    error: execution.error,
  };

  if (explanation) {
    result.explanation = explanation;
  }

  if (code) {
    result.code = code;
  }

  console.log(
    "[data-analysis] analysis_complete",
    JSON.stringify({
      datasetId: parsed.datasetId,
      success: execution.success,
      contextId: finalContextId,
    })
  );

  return dataAnalysisOutputSchema.parse(result);
}
