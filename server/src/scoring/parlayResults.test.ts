import { describe, expect, it } from "vitest";
import type { LegResult, ParlayStatus, RiskMode, StoredParlay, StoredParlayLeg } from "../types.js";
import {
  adjustedDecimalOdds,
  buildParlayPerformance,
  calculateParlayRecordByType,
  calculateParlayRoi,
  calculateParlayStatus,
  calculateParlayWinRate,
} from "./parlayResults.js";

let legSeq = 0;

function leg(result: LegResult, odds = -110): StoredParlayLeg {
  legSeq += 1;
  return {
    id: `leg-${legSeq}`,
    market: "Moneyline",
    selection: "Test ML",
    gameId: "g1",
    game: "AWAY @ HOME",
    odds,
    impliedProbability: 0.52,
    modelProbability: 0.58,
    edge: 0.06,
    confidenceScore: 70,
    confidenceLabel: "Strong",
    reason: "test",
    dataPoints: [],
    riskNote: "test",
    subjectKey: `subject-${legSeq}`,
    result,
    settledAt: result === "pending" ? null : "2026-06-12T23:00:00Z",
  };
}

function parlay(type: RiskMode, status: ParlayStatus, legs: StoredParlayLeg[]): StoredParlay {
  return {
    id: `${type}-${Math.random()}`,
    date: "2026-06-12",
    type,
    name: `Parlay ${type}`,
    legs,
    combinedOdds: 600,
    combinedDecimal: 7,
    modelProbability: 0.2,
    impliedProbability: 0.14,
    edge: 0.06,
    generatedAt: "2026-06-12T12:00:00Z",
    status,
    settledAt: status === "PENDING" ? null : "2026-06-12T23:30:00Z",
    resultReason: null,
  };
}

describe("calculateParlayStatus", () => {
  it("wins only when every leg wins", () => {
    expect(calculateParlayStatus([leg("won"), leg("won"), leg("won")])).toBe("WON");
  });

  it("loses when a single leg loses", () => {
    expect(calculateParlayStatus([leg("won"), leg("won"), leg("lost")])).toBe("LOST");
  });

  it("loses immediately even when other legs are still pending", () => {
    expect(calculateParlayStatus([leg("lost"), leg("pending"), leg("won")])).toBe("LOST");
  });

  it("stays pending while any leg is pending and none lost", () => {
    expect(calculateParlayStatus([leg("won"), leg("pending")])).toBe("PENDING");
  });

  it("treats void/push as no-action, not a loss (adjusted win)", () => {
    expect(calculateParlayStatus([leg("won"), leg("void"), leg("won")])).toBe("WON");
  });

  it("voids the parlay when every leg is void/pushed", () => {
    expect(calculateParlayStatus([leg("void"), leg("void")])).toBe("VOID");
  });
});

describe("adjustedDecimalOdds", () => {
  it("drops void legs from the payout", () => {
    const legs = [leg("won", 100), leg("void", 200), leg("won", 100)];
    // Two +100 winners = 2.0 * 2.0; the void +200 leg contributes nothing.
    expect(adjustedDecimalOdds(legs)).toBeCloseTo(4, 5);
  });
});

describe("calculateParlayWinRate", () => {
  it("measures full parlays, never individual legs", () => {
    const parlays = [
      // 9 winning legs across these parlays, but only 1 of 2 settled parlays won.
      parlay("conservative", "WON", [leg("won"), leg("won"), leg("won"), leg("won")]),
      parlay("balanced", "LOST", [leg("won"), leg("won"), leg("won"), leg("won"), leg("won"), leg("lost")]),
    ];
    expect(calculateParlayWinRate(parlays)).toBe(50);
  });

  it("excludes pending and void parlays from the denominator", () => {
    const parlays = [
      parlay("conservative", "WON", [leg("won")]),
      parlay("balanced", "PENDING", [leg("pending")]),
      parlay("aggressive", "VOID", [leg("void")]),
    ];
    expect(calculateParlayWinRate(parlays)).toBe(100);
  });
});

describe("calculateParlayRoi", () => {
  it("computes ROI per full parlay at flat stakes", () => {
    const parlays = [
      // Won with two +100 legs -> returns 4.0, profit +3.
      parlay("conservative", "WON", [leg("won", 100), leg("won", 100)]),
      parlay("balanced", "LOST", [leg("lost", 100)]),
      parlay("aggressive", "LOST", [leg("lost", 100)]),
    ];
    // (+3 - 1 - 1) / 3 staked = +33.3%
    expect(calculateParlayRoi(parlays)).toBeCloseTo(33.3, 1);
  });

  it("ignores pending and void parlays", () => {
    const parlays = [
      parlay("conservative", "PENDING", [leg("pending")]),
      parlay("balanced", "VOID", [leg("void")]),
    ];
    expect(calculateParlayRoi(parlays)).toBe(0);
  });
});

describe("calculateParlayRecordByType", () => {
  it("splits the record by conservative/balanced/aggressive", () => {
    const parlays = [
      parlay("conservative", "WON", [leg("won")]),
      parlay("conservative", "LOST", [leg("lost")]),
      parlay("balanced", "WON", [leg("won")]),
      parlay("aggressive", "PENDING", [leg("pending")]),
    ];
    const byType = calculateParlayRecordByType(parlays);
    const conservative = byType.find((t) => t.type === "conservative");
    const balanced = byType.find((t) => t.type === "balanced");
    const aggressive = byType.find((t) => t.type === "aggressive");
    expect(conservative).toMatchObject({ wins: 1, losses: 1, winRate: 50 });
    expect(balanced).toMatchObject({ wins: 1, losses: 0, winRate: 100 });
    expect(aggressive).toMatchObject({ wins: 0, losses: 0, pending: 1 });
  });
});

describe("buildParlayPerformance", () => {
  it("summarizes full-parlay record, win rate and ROI", () => {
    const parlays = [
      parlay("conservative", "WON", [leg("won", 100)]),
      parlay("balanced", "LOST", [leg("lost")]),
      parlay("aggressive", "PENDING", [leg("pending")]),
    ];
    const perf = buildParlayPerformance(parlays);
    expect(perf.record).toEqual({ wins: 1, losses: 1, pending: 1, voids: 0 });
    expect(perf.winRate).toBe(50);
    expect(perf.totalParlays).toBe(3);
    expect(perf.avgClv).toBeNull();
    expect(perf.byType).toHaveLength(3);
  });
});
