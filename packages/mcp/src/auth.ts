import { EnvBindings } from "./types";

const textEncoder = new TextEncoder();

export function parseConfiguredApiKeys(
  configured: string | undefined
): string[] {
  if (!configured) {
    return [];
  }

  return configured
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader?.trim()) {
    return apiKeyHeader.trim();
  }

  return null;
}

export function timingSafeEqualString(
  expected: string,
  provided: string
): boolean {
  const expectedBytes = textEncoder.encode(expected);
  const providedBytes = textEncoder.encode(provided);

  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }

  const subtle = crypto.subtle as Crypto["subtle"] & {
    timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean;
  };

  if (typeof subtle.timingSafeEqual === "function") {
    return subtle.timingSafeEqual(expectedBytes, providedBytes);
  }

  let accumulator = 0;
  for (let index = 0; index < expectedBytes.length; index += 1) {
    accumulator |= expectedBytes[index] ^ providedBytes[index];
  }

  return accumulator === 0;
}

export function isRequestAuthorized(
  request: Request,
  env: EnvBindings
): boolean {
  const configuredKeys = parseConfiguredApiKeys(env.MCP_API_KEYS);
  console.log("configuredKeys", configuredKeys);

  if (configuredKeys.length === 0) {
    return true;
  }

  if (request.method === "OPTIONS") {
    return true;
  }

  const providedKey = extractApiKey(request);
  if (!providedKey) {
    return false;
  }

  return configuredKeys.some((configuredKey) =>
    timingSafeEqualString(configuredKey, providedKey)
  );
}
