import { z } from "zod";

/**
 * RAWG game summary subset used across the stack.
 */
export const gameSummarySchema = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  released: z.string().nullable(),
  metacritic: z.number().nullable(),
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
  rating: z.number().nullable(),
});

export type GameSummary = z.infer<typeof gameSummarySchema>;
