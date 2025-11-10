import { z } from "zod";

/**
 * RAWG game summary subset used across the stack.
 */
export const gameSummarySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  released: z.string().nullable(),
  tba: z.boolean().optional(),
  updated: z.string().nullable().optional(),
  background_image: z.string().nullable().optional(),
  saturated_color: z.string().nullable().optional(),
  dominant_color: z.string().nullable().optional(),
  playtime: z
    .number()
    .nullable()
    .optional()
    .describe("amount people play the game on avg (hours)"),
  metacritic: z.number().nullable(),
  score: z.union([z.number(), z.string()]).nullable().optional(),
  rating: z
    .number()
    .nullable()
    .transform((rating) => (rating == 0 ? null : rating)),
  rating_top: z.number().nullable().optional(),
  ratings: z
    .array(
      z.object({
        id: z.number(),
        title: z.string(),
        count: z.number(),
        percent: z.number(),
      })
    )
    .nullish()
    .transform((ratings) => ratings ?? []),
  ratings_count: z
    .number()
    .nullable()
    .optional()
    .describe("ratings on RAWG.io"),
  reviews_count: z
    .number()
    .nullable()
    .optional()
    .describe("reviews on metacritic"),
  reviews_text_count: z
    .number()
    .nullable()
    .optional()
    .describe("text reviews on RAWG.io"),
  added: z
    .number()
    .nullable()
    .describe("Total RAWG users who added this game to their lists.")
    .optional(),
  added_by_status: z
    .object({
      yet: z
        .number()
        .nullable()
        .optional()
        .describe("players who intend to try it"),
      owned: z.number().nullable().optional().describe("already purchased"),
      beaten: z
        .number()
        .nullable()
        .optional()
        .describe("finished the main experience"),
      toplay: z
        .number()
        .nullable()
        .optional()
        .describe("placed on a wishlist/backlog"),
      dropped: z
        .number()
        .nullable()
        .optional()
        .describe("explicitly abandoned"),
      playing: z.number().nullable().optional().describe("currently playing"),
    })
    .partial()
    .nullish()
    .transform((status) => status ?? {}),
  suggestions_count: z
    .number()
    .nullable()
    .optional()
    .describe("RAWG suggestion graph connections"),
  genres: z
    .array(
      z.object({
        id: z.number(),
        slug: z.string(),
        name: z.string(),
      })
    )
    .nullish()
    .transform((genres) => genres ?? []),
  tags: z
    .array(
      z.object({
        id: z.number(),
        slug: z.string(),
        name: z.string(),
        language: z.string().nullable().optional(),
        games_count: z.number().nullable().optional(),
        image_background: z.string().nullable().optional(),
      })
    )
    .nullish()
    .transform((tags) => tags ?? []),
  platforms: z
    .array(
      z.object({
        platform: z.object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
        }),
      })
    )
    .nullish()
    .transform((platforms) => platforms ?? []),
  parent_platforms: z
    .array(
      z.object({
        platform: z.object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
        }),
      })
    )
    .nullish()
    .transform((parentPlatforms) => parentPlatforms ?? []),
  stores: z
    .array(
      z.object({
        store: z.object({
          id: z.number(),
          slug: z.string(),
          name: z.string(),
          domain: z.string().nullable().optional(),
          games_count: z.number().nullable().optional(),
          image_background: z.string().nullable().optional(),
        }),
      })
    )
    .nullish()
    .transform((stores) => stores ?? []),
  short_screenshots: z
    .array(
      z.object({
        id: z.number(),
        image: z.string(),
      })
    )
    .nullish()
    .transform((screenshots) => screenshots ?? []),
  esrb_rating: z
    .object({
      id: z.number(),
      slug: z.string(),
      name: z.string(),
      name_en: z.string().nullable().optional(),
      name_ru: z.string().nullable().optional(),
    })
    .nullish(),
  user_game: z.unknown().nullable().optional(),
  clip: z
    .object({
      clip: z.string().nullable().optional(),
      clips: z
        .object({
          "320": z.string().nullable().optional(),
          "640": z.string().nullable().optional(),
          full: z.string().nullable().optional(),
        })
        .partial()
        .optional(),
      preview: z.string().nullable().optional(),
      video: z.string().nullable().optional(),
    })
    .partial()
    .nullable()
    .optional(),
});

export type GameSummary = z.infer<typeof gameSummarySchema>;
