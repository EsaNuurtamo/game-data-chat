import { z } from "zod";

/**
 * RAWG game summary subset used across the stack.
 */
export const gameSummarySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  released: z.string().nullable(),
  playtime: z
    .number()
    .nullable()
    .optional()
    .describe("amount people play the game on avg (hours)"),
  metacritic: z.number().nullable(),
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
  rating: z
    .number()
    .nullable()
    .transform((rating) => (rating == 0 ? null : rating)),
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
});

export type GameSummary = z.infer<typeof gameSummarySchema>;
