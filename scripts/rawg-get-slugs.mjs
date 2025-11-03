#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const trimmed = token.slice(2);
    if (trimmed.length === 0) {
      continue;
    }
    let key;
    let value;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex !== -1) {
      key = trimmed.slice(0, equalsIndex);
      value = trimmed.slice(equalsIndex + 1);
    } else {
      key = trimmed;
      const candidate = argv[i + 1];
      if (candidate && !candidate.startsWith("--")) {
        value = candidate;
        i += 1;
      } else {
        value = true;
      }
    }
    options[key] = value;
  }
  return { positional, options };
}

function toSlugIdentifier(resourcePath) {
  return resourcePath
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\/+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function normalizePath(pathExpression) {
  return pathExpression
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((segment) => segment.length > 0);
}

function getValue(item, pathExpression) {
  const segments = normalizePath(pathExpression);
  let current = item;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = current[segment];
    }
  }
  return current;
}

function parseOrder(option) {
  if (!option) {
    return [{ field: "games_count", direction: "desc" }];
  }

  const clauses = option
    .split(/[;|]/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);

  if (clauses.length === 0) {
    return [{ field: "games_count", direction: "desc" }];
  }

  return clauses.map((clause) => {
    const parts = clause.split(",");
    const field = parts[0]?.trim();
    let direction = parts[1]?.trim().toLowerCase() ?? "desc";
    if (direction !== "asc" && direction !== "desc") {
      direction = "desc";
    }
    if (!field) {
      throw new Error(`Invalid order clause: "${clause}"`);
    }
    return { field, direction };
  });
}

function compareByOrder(order, a, b) {
  for (const { field, direction } of order) {
    const valueA = getValue(a, field);
    const valueB = getValue(b, field);

    if (valueA === valueB) {
      continue;
    }

    if (valueA == null) {
      return direction === "asc" ? 1 : -1;
    }
    if (valueB == null) {
      return direction === "asc" ? -1 : 1;
    }

    if (typeof valueA === "number" && typeof valueB === "number") {
      return direction === "asc" ? valueA - valueB : valueB - valueA;
    }

    const stringA = String(valueA).toLowerCase();
    const stringB = String(valueB).toLowerCase();
    if (stringA === stringB) {
      continue;
    }
    if (stringA < stringB) {
      return direction === "asc" ? -1 : 1;
    }
    return direction === "asc" ? 1 : -1;
  }
  return 0;
}

function toSlug(value, fallback) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  }
  return fallback;
}

async function main() {
  const { positional, options } = parseArgs(process.argv.slice(2));

  if (positional.length === 0) {
    console.error(
      "Usage: pnpm get-slugs <resource-path> [--order=field,desc] [--limit=N] [--output=path]"
    );
    process.exitCode = 1;
    return;
  }

  const resourcePath = positional[0].replace(/^\/+/, "").replace(/\/+$/, "");
  if (resourcePath.length === 0) {
    console.error("Resource path must not be empty.");
    process.exitCode = 1;
    return;
  }

  const identifier = toSlugIdentifier(resourcePath);
  const dataDir = path.resolve(".data");
  const jsonPath =
    options.input ?? path.join(dataDir, `rawg-${identifier}.json`);

  let payload;
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    payload = JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to read dataset at ${jsonPath}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload)
        ? payload
        : null;

  if (!Array.isArray(items) || items.length === 0) {
    console.error(
      `Dataset ${jsonPath} does not contain an "items" array with entries.`
    );
    process.exitCode = 1;
    return;
  }

  let order;
  try {
    order = parseOrder(options.order ?? options.ordering);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const limit = toPositiveInteger(options.limit, 100);

  const sorted = [...items].sort((a, b) => compareByOrder(order, a, b));
  const topItems = sorted.slice(0, limit);

  const lines = topItems.map((item, index) => {
    const slug =
      item?.slug && typeof item.slug === "string" && item.slug.trim().length > 0
        ? item.slug.trim()
        : toSlug(item?.name, `item-${index}`);
    return slug;
  });

  if (lines.length === 0) {
    console.error("No items produced after sorting.");
    process.exitCode = 1;
    return;
  }

  const outputPath =
    options.output ??
    options.out ??
    path.join(dataDir, `${identifier}-slugs.txt`);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    `Wrote ${lines.length} slugs for ${resourcePath} to ${outputPath} (order=${order
      .map(({ field, direction }) => `${field} ${direction}`)
      .join(", ")})`
  );
}

main().catch((error) => {
  console.error("Failed to create slug list.");
  console.error(error);
  process.exitCode = 1;
});
