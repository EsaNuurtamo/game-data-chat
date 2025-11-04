import { DEFAULT_DATASET_TTL_MS, SUPPORTED_TAGS } from "@game-data/db";

export const VERSION = "0.5.0";
export const RAWG_API_BASE = "https://api.rawg.io/api/games";
export const RAWG_PLATFORMS_BASE = "https://api.rawg.io/api/platforms";
export const CACHE_TTL_SECONDS = Math.floor(DEFAULT_DATASET_TTL_MS / 1000);

export const PLATFORM_CACHE_VERSION = "v1";
export const PLATFORM_CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours
export const PLATFORM_DIRECTORY_KEY = `rawg:platforms:${PLATFORM_CACHE_VERSION}`;

export const TAG_DESCRIPTIONS = SUPPORTED_TAGS;
