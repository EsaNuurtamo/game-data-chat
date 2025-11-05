import "server-only";

import { kvDatasetRecordSchema, type KvDatasetRecord } from "@game-data/db";

import { getMcpBaseUrl } from "@/lib/mcp";

interface FetchDatasetOptions {
  baseUrl?: string;
}

export async function fetchDatasetById(
  rawId: string,
  options: FetchDatasetOptions = {}
): Promise<KvDatasetRecord | null> {
  const datasetId = rawId.trim();
  if (!datasetId) {
    throw new Error("Dataset id must be provided");
  }

  const baseUrl = options.baseUrl ?? getMcpBaseUrl();
  const target = `${baseUrl}/datasets/${encodeURIComponent(datasetId)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.MCP_API_KEY;
  if (typeof apiKey === "string" && apiKey.trim().length > 0) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch(target, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load dataset ${datasetId}: ${response.status} ${response.statusText}`
    );
  }

  const data: unknown = await response.json();
  const parsed = kvDatasetRecordSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Dataset ${datasetId} did not match expected shape: ${parsed.error.message}`
    );
  }

  return parsed.data;
}
