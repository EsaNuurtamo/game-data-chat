import { normalizeFilterValue } from "@game-data/db";
import { z } from "zod";

import {
  PLATFORM_CACHE_TTL_SECONDS,
  PLATFORM_CACHE_VERSION,
  PLATFORM_DIRECTORY_KEY,
  RAWG_PLATFORMS_BASE
} from "./constants";
import { EnvBindings } from "./types";
import { safeReadError } from "./utils";

export type PlatformSummary = {
  id: number;
  slug: string;
  name: string;
};

export type PlatformDirectoryRecord = {
  version: string;
  fetchedAt: string;
  expiresAt: string;
  platforms: PlatformSummary[];
};

const rawgPlatformSchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string()
});

const rawgPlatformResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(rawgPlatformSchema)
});

const platformDirectoryRecordSchema = z.object({
  version: z.string(),
  fetchedAt: z.string(),
  expiresAt: z.string(),
  platforms: z.array(rawgPlatformSchema)
});

const PARENT_PLATFORM_SLUG_TO_ID: Record<string, string> = {
  pc: "1",
  windows: "1",
  playstation: "2",
  ps: "2",
  xbox: "3",
  ios: "4",
  mac: "5",
  "apple-macintosh": "5",
  linux: "6",
  nintendo: "7",
  android: "8",
  atari: "9",
  amiga: "10",
  "commodore-amiga": "10",
  sega: "11",
  "3do": "12",
  "neo-geo": "13",
  web: "14",
  browser: "14"
};

export async function resolvePlatformIds(
  platformFilters: string[],
  env: EnvBindings
): Promise<string[]> {
  if (platformFilters.length === 0) {
    return [];
  }

  const directory = await getPlatformDirectory(env);
  const slugMap = new Map<string, string>();

  for (const platform of directory.platforms) {
    const id = String(platform.id);
    const normalizedSlug = normalizeFilterValue(platform.slug);
    const normalizedName = normalizeFilterValue(platform.name);
    slugMap.set(normalizedSlug, id);
    slugMap.set(platform.slug.toLowerCase(), id);
    slugMap.set(normalizedName, id);
  }

  const resolved = new Set<string>();

  for (const value of platformFilters) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (/^\d+$/.test(trimmed)) {
      resolved.add(trimmed);
      continue;
    }
    const normalized = normalizeFilterValue(trimmed);
    const lower = trimmed.toLowerCase();
    const resolvedId = slugMap.get(normalized) ?? slugMap.get(lower);
    if (resolvedId) {
      resolved.add(resolvedId);
    } else {
      console.warn(
        "[mcp] unresolved_platform",
        JSON.stringify({
          input: trimmed
        })
      );
    }
  }

  return Array.from(resolved);
}

export function resolveParentPlatformIds(parentFilters: string[]): string[] {
  if (parentFilters.length === 0) {
    return [];
  }

  const resolved = new Set<string>();

  for (const value of parentFilters) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (/^\d+$/.test(trimmed)) {
      resolved.add(trimmed);
      continue;
    }
    const normalized = normalizeFilterValue(trimmed);
    const lower = trimmed.toLowerCase();
    const resolvedId =
      PARENT_PLATFORM_SLUG_TO_ID[normalized] ?? PARENT_PLATFORM_SLUG_TO_ID[lower];
    if (resolvedId) {
      resolved.add(resolvedId);
    } else {
      console.warn(
        "[mcp] unresolved_parent_platform",
        JSON.stringify({
          input: trimmed
        })
      );
    }
  }

  return Array.from(resolved);
}

async function getPlatformDirectory(env: EnvBindings): Promise<PlatformDirectoryRecord> {
  const cached = await env.RAWG_CACHE.get(PLATFORM_DIRECTORY_KEY, { type: "json" });
  if (cached) {
    const parsed = platformDirectoryRecordSchema.safeParse(cached);
    if (parsed.success) {
      if (parsed.data.version === PLATFORM_CACHE_VERSION && !shouldRefreshDirectory(parsed.data)) {
        return parsed.data;
      }
    }
  }

  const record = await fetchPlatformDirectory(env);
  await env.RAWG_CACHE.put(PLATFORM_DIRECTORY_KEY, JSON.stringify(record), {
    expirationTtl: PLATFORM_CACHE_TTL_SECONDS
  });
  return record;
}

function shouldRefreshDirectory(record: PlatformDirectoryRecord, now: Date = new Date()): boolean {
  return new Date(record.expiresAt).getTime() <= now.getTime();
}

async function fetchPlatformDirectory(env: EnvBindings): Promise<PlatformDirectoryRecord> {
  if (!env.RAWG_API_KEY) {
    throw new Error("RAWG_API_KEY is not configured");
  }

  const platforms: PlatformSummary[] = [];
  let nextUrl: string | null = buildPlatformsUrl(env.RAWG_API_KEY, 1);

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      const message = await safeReadError(response);
      throw new Error(`RAWG platforms request failed (${response.status}): ${message}`);
    }
    const json: unknown = await response.json();
    const parsed = rawgPlatformResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`Failed to parse RAWG platforms response: ${parsed.error.message}`);
    }

    platforms.push(...parsed.data.results);

    if (!parsed.data.next) {
      nextUrl = null;
    } else {
      const next = new URL(parsed.data.next);
      if (!next.searchParams.has("key")) {
        next.searchParams.set("key", env.RAWG_API_KEY);
      }
      if (!next.searchParams.has("page_size")) {
        next.searchParams.set("page_size", "40");
      }
      nextUrl = next.toString();
    }
  }

  const now = new Date();
  return {
    version: PLATFORM_CACHE_VERSION,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + PLATFORM_CACHE_TTL_SECONDS * 1000).toISOString(),
    platforms
  };
}

function buildPlatformsUrl(apiKey: string, page: number): string {
  const url = new URL(RAWG_PLATFORMS_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", "40");
  return url.toString();
}
