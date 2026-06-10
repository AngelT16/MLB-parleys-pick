import { describe, expect, it } from "vitest";
import { generatePickPool } from "./probabilityEngine.js";
import { generateDailyParlays } from "./parlayGenerator.js";

describe("generateDailyParlays", () => {
  it("creates three differentiated parlays without forcing no-bet picks", () => {
    const parlays = generateDailyParlays(generatePickPool());

    expect(parlays).toHaveLength(3);
    for (const parlay of parlays) {
      expect(parlay.legs.length).toBeGreaterThanOrEqual(8);
      expect(parlay.legs.length).toBeLessThanOrEqual(10);
      expect(parlay.legs.every((leg) => leg.edge > 0 && leg.confidenceLabel !== "Avoid / No Bet")).toBe(true);
    }

    expect(parlays[0].legs.map((leg) => leg.id)).not.toEqual(parlays[1].legs.map((leg) => leg.id));
    expect(parlays[1].legs.map((leg) => leg.id)).not.toEqual(parlays[2].legs.map((leg) => leg.id));
  });

  it("limits same-game exposure", () => {
    const parlays = generateDailyParlays(generatePickPool());

    for (const parlay of parlays) {
      const counts = new Map<string, number>();
      for (const leg of parlay.legs) {
        counts.set(leg.gameId, (counts.get(leg.gameId) ?? 0) + 1);
      }
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(parlay.profile === "Aggressive" ? 3 : 2);
    }
  });
});
