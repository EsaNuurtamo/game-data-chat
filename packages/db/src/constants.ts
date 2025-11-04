export const DEFAULT_PAGE_SIZE = 40;
export const DATASET_VERSION = "v1";
export const DATASET_NAMESPACE_PREFIX = `rawg:games:${DATASET_VERSION}`;
export const DEFAULT_DATASET_TTL_MS = 1000 * 60 * 60; // 1 hour

export const SUPPORTED_TAGS = [
  { slug: "singleplayer", description: "Focus on solo play experiences." },
  { slug: "multiplayer", description: "Supports cooperative or competitive multiplayer." },
  { slug: "exclusive", description: "Titles limited to a specific platform or ecosystem." }
] as const;
