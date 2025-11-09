import { describe, expect, it } from "vitest";

import type { GameSummary } from "./schemas";
import { runJsonQuery } from "./jsonQuery";

const sampleDataset = {
  items: [
    buildGame({
      id: 1,
      name: "Alpha Runner",
      rating: 4.8,
      genres: [
        buildGenre(10, "action"),
        buildGenre(11, "indie"),
      ],
      platforms: [
        buildPlatform(1, "pc"),
        buildPlatform(2, "playstation-5"),
      ],
    }),
    buildGame({
      id: 2,
      name: "Beta Knights",
      rating: 4.2,
      genres: [
        buildGenre(10, "action"),
        buildGenre(12, "rpg"),
      ],
      platforms: [
        buildPlatform(1, "pc"),
        buildPlatform(3, "nintendo-switch"),
      ],
    }),
    buildGame({
      id: 3,
      name: "Gamma Valley",
      rating: 3.6,
      genres: [buildGenre(12, "rpg")],
      platforms: [buildPlatform(2, "playstation-5")],
    }),
  ],
};

describe("runJsonQuery", () => {
  it("counts games per genre via unnest + groupBy", () => {
    const result = runJsonQuery(sampleDataset, `
      .items
        | unnest(.genres)
        | groupBy(.genres.name)
        | mapValues(size())
    `);

    expect(result).toEqual({
      action: 2,
      indie: 1,
      rpg: 2,
    });
  });

  it("computes average rating per platform", () => {
    const result = runJsonQuery(sampleDataset, `
      .items
        | unnest(.platforms)
        | groupBy(.platforms.platform.name)
        | mapValues(map(.rating) | average())
    `);

    expect(result).toEqual({
      pc: (4.8 + 4.2) / 2,
      "playstation-5": (4.8 + 3.6) / 2,
      "nintendo-switch": 4.2,
    });
  });

  it("filters games with rating above 4", () => {
    const result = runJsonQuery<GameSummary[]>(sampleDataset, `
      .items
        | filter(.rating > 4)
    `);

    expect(result.map((game) => game.name)).toEqual([
      "Alpha Runner",
      "Beta Knights",
    ]);
  });

  it("returns the top 2 games by rating", () => {
    const result = runJsonQuery(sampleDataset, `
      .items
        | sort(.rating, "desc")
        | limit(2)
        | pick(.name, .rating)
    `);

    expect(result).toEqual([
      { name: "Alpha Runner", rating: 4.8 },
      { name: "Beta Knights", rating: 4.2 },
    ]);
  });
});

function buildGame(
  overrides: Partial<GameSummary> & Pick<GameSummary, "id" | "name" | "rating">
): GameSummary {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
    released: overrides.released ?? "2024-01-01",
    metacritic: overrides.metacritic ?? 85,
    rating: overrides.rating,
    genres: overrides.genres ?? [],
    platforms: overrides.platforms ?? [],
  };
}

function buildGenre(id: number, slug: string) {
  return { id, slug, name: slug.replace(/-/g, " ") };
}

function buildPlatform(id: number, slug: string) {
  return {
    platform: {
      id,
      slug,
      name: slug,
    },
  };
}
