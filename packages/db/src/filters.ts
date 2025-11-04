import { z } from "zod";

import { DEFAULT_PAGE_SIZE, SUPPORTED_TAGS } from "./constants";

export const fetchFiltersSchema = z.object({
  genres: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  parentPlatforms: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  releasedFrom: z.string().optional(),
  releasedTo: z.string().optional(),
  page: z.number().min(1).max(40).optional(),
  pageSize: z.number().min(1).max(DEFAULT_PAGE_SIZE).optional(),
});

export type FetchFilters = z.infer<typeof fetchFiltersSchema>;

export interface CanonicalizedFilters {
  genres: string[];
  platforms: string[];
  parentPlatforms: string[];
  tags: string[];
  releasedFrom?: string;
  releasedTo?: string;
  page: number;
  pageSize: number;
}

export function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function expandFilterValues(values?: string[]): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  const expanded: string[] = [];
  for (const value of values) {
    const chunks = value
      .split(",")
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
    expanded.push(...chunks);
  }
  return expanded;
}

export function canonicalizeFilters(
  filters: FetchFilters
): CanonicalizedFilters {
  const genres = expandFilterValues(filters.genres)
    .map(normalizeFilterValue)
    .sort();
  const platforms = expandFilterValues(filters.platforms)
    .map(normalizeFilterValue)
    .sort();
  const parentPlatforms = expandFilterValues(filters.parentPlatforms)
    .map(normalizeFilterValue)
    .sort();
  const allowedTagSlugs = new Set(
    SUPPORTED_TAGS.map((tag) => normalizeFilterValue(tag.slug))
  );
  const tags = expandFilterValues(filters.tags)
    .map(normalizeFilterValue)
    .filter((tag) => allowedTagSlugs.has(tag))
    .sort();

  return {
    genres,
    platforms,
    parentPlatforms,
    tags,
    releasedFrom: filters.releasedFrom,
    releasedTo: filters.releasedTo,
    page: filters.page ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}
