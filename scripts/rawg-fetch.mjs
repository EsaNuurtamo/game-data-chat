#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * Minimal CLI argument parser.
 */
function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) {
      positional.push(raw);
      continue;
    }
    const keyValue = raw.slice(2);
    if (keyValue.length === 0) {
      continue;
    }
    let key;
    let value;
    const equalsIndex = keyValue.indexOf("=");
    if (equalsIndex !== -1) {
      key = keyValue.slice(0, equalsIndex);
      value = keyValue.slice(equalsIndex + 1);
    } else {
      key = keyValue;
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        value = next;
        i += 1;
      } else {
        value = true;
      }
    }
    options[key] = value;
  }
  return { positional, options };
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function toNonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function toSlugIdentifier(resourcePath) {
  return resourcePath
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

async function fetchPage({
  apiKey,
  resourcePath,
  page,
  pageSize,
  ordering,
  searchQuery,
  extraQuery,
}) {
  const url = new URL(`https://api.rawg.io/api/${resourcePath}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));
  if (ordering) {
    url.searchParams.set("ordering", ordering);
  }
  if (searchQuery) {
    url.searchParams.set("search", searchQuery);
  }
  for (const [key, value] of extraQuery) {
    url.searchParams.set(key, value);
  }

  const MAX_RETRIES = 8;
  const BASE_DELAY_MS = 250;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.text();
        const message = `RAWG API returned ${response.status} ${response.statusText} (page ${page}): ${body}`;
        if (attempt < MAX_RETRIES && RETRYABLE_STATUSES.has(response.status)) {
          const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
          console.warn(`${message}. Retrying in ${backoff}ms.`);
          await delay(backoff);
          continue;
        }
        throw new Error(message);
      }
      return response.json();
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw error;
      }
      const backoff = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `Request failed (attempt ${attempt}/${MAX_RETRIES}): ${
          error.message ?? error
        }. Retrying in ${backoff}ms.`
      );
      await delay(backoff);
    }
  }

  throw new Error(`Unable to fetch RAWG page ${page} for ${resourcePath}.`);
}

async function fetchAll({
  apiKey,
  resourcePath,
  pageSize,
  ordering,
  searchQuery,
  extraQuery,
  delayMs,
  maxPages,
}) {
  const items = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    if (maxPages !== null && page > maxPages) {
      break;
    }
    const payload = await fetchPage({
      apiKey,
      resourcePath,
      page,
      pageSize,
      ordering,
      searchQuery,
      extraQuery,
    });
    const results = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.results)
        ? payload.results
        : null;
    if (!Array.isArray(results)) {
      throw new Error(
        `Unexpected response shape for ${resourcePath}. Expected an array of results.`
      );
    }
    items.push(...results);

    const nextPage = page + 1;
    hasNext =
      Boolean(payload?.next) && (maxPages === null || nextPage <= maxPages);
    page = nextPage;
    if (hasNext && delayMs > 0) {
      await delay(delayMs);
    }
  }

  return items;
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length === 0) {
    console.error(
      "Usage: pnpm fetch:rawg <resource-path> [--page-size=N] [--max-pages=N] [--delay-ms=N] [--ordering=-field] [--search=query] [--query key=value]"
    );
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) {
    console.error("Missing RAWG_API_KEY environment variable.");
    process.exitCode = 1;
    return;
  }

  const resourcePath = positional[0].replace(/^\/+/, "").replace(/\/+$/, "");
  if (resourcePath.length === 0) {
    console.error("Resource path must not be empty.");
    process.exitCode = 1;
    return;
  }

  const pageSize = toPositiveInteger(options["page-size"], 40);
  const delayMs = toNonNegativeInteger(options["delay-ms"], 250);
  const maxPages =
    options["max-pages"] === undefined
      ? null
      : toPositiveInteger(options["max-pages"], null);
  const ordering = options.ordering ?? options.order ?? null;
  const searchQuery = options.search ?? null;

  const extraQuery = [];
  for (const [key, value] of Object.entries(options)) {
    if (!key.startsWith("query.")) {
      continue;
    }
    const paramKey = key.slice("query.".length);
    if (paramKey.length === 0) {
      continue;
    }
    extraQuery.push([paramKey, String(value)]);
  }

  const startedAt = new Date();
  console.log(
    `Fetching RAWG ${resourcePath} (pageSize=${pageSize}, maxPages=${
      maxPages ?? "all"
    }, ordering=${ordering ?? "default"})`
  );
  const items = await fetchAll({
    apiKey,
    resourcePath,
    pageSize,
    ordering,
    searchQuery,
    extraQuery,
    delayMs,
    maxPages,
  });
  const finishedAt = new Date();

  const identifier = toSlugIdentifier(resourcePath);
  const outputDir = path.resolve(".data");
  const jsonPath = path.join(outputDir, `rawg-${identifier}.json`);

  await fs.mkdir(outputDir, { recursive: true });
  const payload = {
    resourcePath,
    fetchedAt: finishedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    totalItems: items.length,
    pageSize,
    maxPages,
    ordering,
    search: searchQuery,
    items,
  };
  await fs.writeFile(jsonPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(
    `Fetched ${items.length} entries for ${resourcePath}. JSON saved to ${jsonPath}`
  );
  console.log(
    `Duration: ${((finishedAt - startedAt) / 1000).toFixed(2)} seconds`
  );
}

main().catch((error) => {
  console.error("Failed to fetch RAWG data.");
  console.error(error);
  process.exitCode = 1;
});
