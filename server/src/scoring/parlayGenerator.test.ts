import { describe, expect, it } from "vitest";
import { buildMockDay } from "../mockData.js";
import { generateParlays } from "./parlayGenerator.js";
import { applyCorrelationPenalty } from "./correlation.js";
import {
  scoreFirstFiveTotalPick,
  scoreGameTotalPick,
  scoreHitPick,
  scoreMoneylinePick,
  scorePitcherStrikeoutPick,
  scoreTwoTotalBasesPick,
} from "./scoringEngine.js";
import type { AppSettings, PickLeg } from "../types.js";

const SETTINGS: AppSettings = {
  minLegs: 8,
  maxLegs: 10,
  minProbability: 0.4,
  minEdge: 0.01,
  maxPicksPerGame: 3,
  allowCorrelation: true,
  excludeUnconfirmedLineups: false,
  riskMode: "balanced",
};

function buildPool(): PickLeg[] {
  const day = buildMockDay("2026-06-11");
  const pool: PickLeg[] = [];
  for (const game of day.games) {
    pool.push(scoreMoneylinePick(game));
    pool.push(scoreGameTotalPick(game));
    pool.push(scoreFirstFiveTotalPick(game));
    pool.push(scorePitcherStrikeoutPick(game.homePitcher, game, { teamKRate: game.away.teamKRate, abbr: game.away.abbr }));
    pool.push(scorePitcherStrikeoutPick(game.awayPitcher, game, { teamKRate: game.home.teamKRate, abbr: game.home.abbr }));
    for (const b of game.homeLineup.slice(0, 6)) pool.push(scoreHitPick(b, { game, opposingPitcher: game.awayPitcher, isHome: true }));
    for (const b of game.awayLineup.slice(0, 6)) pool.push(scoreHitPick(b, { game, opposingPitcher: game.homePitcher, isHome: false }));
    for (const b of game.homeLineup.slice(0, 3)) pool.push(scoreTwoTotalBasesPick(b, { game, opposingPitcher: game.awayPitcher, isHome: true }));
  }
  return pool;
}

describe("scoring engine", () => {
  it("produces legs with consistent probability/edge fields", () => {
    for (const leg of buildPool()) {
      expect(leg.modelProbability).toBeGreaterThan(0);
      expect(leg.modelProbability).toBeLessThan(1);
      expect(leg.impliedProbability).toBeGreaterThan(0);
      expect(leg.impliedProbability).toBeLessThan(1);
      expect(leg.edge).toBeCloseTo(leg.modelProbability - leg.impliedProbability, 3);
      expect(leg.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(leg.confidenceScore).toBeLessThanOrEqual(100);
      expect(leg.reason.length).toBeGreaterThan(10);
      expect(leg.dataPoints.length).toBeGreaterThan(2);
    }
  });
});

describe("generateParlays", () => {
  const parlays = generateParlays(buildPool(), SETTINGS);

  it("returns conservative, balanced and aggressive parlays", () => {
    expect(parlays.map((p) => p.type)).toEqual(["conservative", "balanced", "aggressive"]);
  });

  it("never exceeds maxLegs and never uses Avoid or negative-edge legs", () => {
    for (const parlay of parlays) {
      expect(parlay.legs.length).toBeLessThanOrEqual(SETTINGS.maxLegs);
      for (const leg of parlay.legs) {
        expect(leg.confidenceLabel).not.toBe("Avoid");
        expect(leg.edge).toBeGreaterThanOrEqual(SETTINGS.minEdge);
      }
    }
  });

  it("respects maxPicksPerGame", () => {
    for (const parlay of parlays) {
      const counts = new Map<string, number>();
      for (const leg of parlay.legs) {
        counts.set(leg.gameId, (counts.get(leg.gameId) ?? 0) + 1);
      }
      for (const count of counts.values()) {
        expect(count).toBeLessThanOrEqual(SETTINGS.maxPicksPerGame);
      }
    }
  });

  it("never repeats the same subject in a parlay", () => {
    for (const parlay of parlays) {
      const subjects = parlay.legs.map((l) => l.subjectKey);
      expect(new Set(subjects).size).toBe(subjects.length);
    }
  });

  it("conservative parlay holds the highest average probability", () => {
    const avg = (legs: PickLeg[]) => legs.reduce((a, l) => a + l.modelProbability, 0) / Math.max(1, legs.length);
    const [conservative, , aggressive] = parlays;
    expect(avg(conservative.legs)).toBeGreaterThanOrEqual(avg(aggressive.legs) - 0.001);
  });

  it("computes combined odds from the legs", () => {
    for (const parlay of parlays) {
      if (parlay.legs.length === 0) continue;
      expect(parlay.combinedDecimal).toBeGreaterThan(1);
      expect(parlay.modelProbability).toBeGreaterThan(0);
      expect(parlay.impliedProbability).toBeCloseTo(1 / parlay.combinedDecimal, 3);
    }
  });
});

describe("applyCorrelationPenalty", () => {
  const day = buildMockDay("2026-06-11");
  const game = day.games[0];
  const hit = scoreHitPick(game.homeLineup[0], { game, opposingPitcher: game.awayPitcher, isHome: true });

  it("blocks duplicate subjects", () => {
    const dup = { ...hit };
    expect(applyCorrelationPenalty([hit], dup, true).blocked).toBe(true);
  });

  it("blocks under-vs-batter conflicts when correlation is disabled", () => {
    const total = scoreGameTotalPick(game);
    if (/under/i.test(total.selection)) {
      expect(applyCorrelationPenalty([total], hit, false).blocked).toBe(true);
    } else {
      // Over + batter prop is positively correlated: allowed but penalized when disabled.
      const result = applyCorrelationPenalty([total], hit, false);
      expect(result.blocked).toBe(false);
      expect(result.adjustedScore).toBeLessThan(hit.confidenceScore);
    }
  });

  it("does not penalize legs from different games", () => {
    const otherGame = day.games[1];
    const ml = scoreMoneylinePick(otherGame);
    const result = applyCorrelationPenalty([ml], hit, true);
    expect(result.blocked).toBe(false);
    expect(result.adjustedScore).toBe(hit.confidenceScore);
  });
});
