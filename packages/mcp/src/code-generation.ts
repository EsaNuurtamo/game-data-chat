import { Experimental_Agent as Agent, Output, stepCountIs } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

import { gameSummarySchema } from "@game-data/db";

const codeGenerationSchema = z.object({
  code: z
    .string()
    .describe(
      "Python code that analyzes the dataset and prints JSON result to stdout"
    ),
  explanation: z
    .string()
    .optional()
    .describe("Brief explanation of what the code does"),
});

export async function generateAnalysisCode(
  question: string,
  datasetSample: unknown,
  apiKey: string,
  modelName: string = "gpt-4o"
): Promise<{ code: string; explanation?: string }> {
  const openai = createOpenAI({ apiKey });

  const agent = new Agent({
    model: openai(modelName),
    experimental_output: Output.object({
      schema: codeGenerationSchema,
    }),
    stopWhen: stepCountIs(5),
  });

  const schemaDescription = JSON.stringify(gameSummarySchema.shape, null, 2);
  const sampleData = JSON.stringify(datasetSample, null, 2).slice(0, 1000);

  const systemPrompt = `You are a code generation assistant that creates Python code to analyze game datasets.

The dataset is a JSON file at /workspace/data.json containing an array of game objects. Each game object follows this schema:
${schemaDescription}

Your task:
1. Generate Python code that reads the JSON file from /workspace/data.json
2. Analyzes the dataset to answer the user's question
3. Prints the result as JSON to stdout (use json.dumps)
4. Use pandas, numpy, matplotlib for data analysis
5. The code should be complete and executable

Example structure:
\`\`\`python
import json
import pandas as pd
import numpy as np

with open('/workspace/data.json', 'r') as f:
    data = json.load(f)

df = pd.DataFrame(data)
# ... analysis ...
result = {...}
print(json.dumps(result))
\`\`\``;

  const userPrompt = `Question: ${question}

Sample data structure (first item):
${sampleData}

Generate Python code to answer this question.`;

  const { experimental_output: output } = await agent.generate({
    prompt: userPrompt,
    system: systemPrompt,
  });

  if (!output || typeof output !== "object" || !("code" in output)) {
    throw new Error("Failed to generate code: invalid output from agent");
  }

  return {
    code: output.code as string,
    explanation: output.explanation as string | undefined,
  };
}
