import { describe, expect, it } from "vitest";
import type { Market, StoredParlay, StoredParlayLeg } from "../types.js";
import {
  applySettlement,
  settleBatterHitPick,
  settleBatterTotalBasesPick,
  settleFirstFiveTotalPick,
  settleFullGameTotalPick,
  settleLeg,
  settleMoneylinePick,
  settlePitcherStrikeoutPick,
  type GameResultData,
} from "./settlementService.js";

let legSeq = 0;

function leg(market: Market, extra: Partial<StoredParlayLeg> = {}): StoredParlayLeg {
  legSeq += 1;
  return {
    id: `leg-${legSeq}`,
    market,
    selection: "Test selection",
    gameId: "777001",
    game: "AWAY @ HOME",
    odds: -110,
    impliedProbability: 0.52,
    modelProbability: 0.6,
    edge: 0.08,
    confidenceScore: 70,
    confidenceLabel: "Strong",
    reason: "test",
    dataPoints: [],
    riskNote: "test",
    subjectKey: `subject-${legSeq}`,
    gamePk: 777001,
    result: "pending",
    settledAt: null,
    ...extra,
  };
}

function finalGame(overrides: Partial<GameResultData> = {}): GameResultData {
  return {
    gamePk: 777001,
    state: "final",
    homeRuns: 5,
    awayRuns: 3,
    f5HomeRuns: 3,
    f5AwayRuns: 1,
    batting: new Map([
      [100, { hits: 2, totalBases: 5, atBats: 4 }],
      [101, { hits: 0, totalBases: 0, atBats: 4 }],
      [102, { hits: 1, totalBases: 1, atBats: 3 }],
    ]),
    pitching: new Map([[200, { strikeOuts: 7 }]]),
    ...overrides,
  };
}

describe("settleMoneylinePick", () => {
  it("wins for the home side when the home team wins", () => {
    expect(settleMoneylinePick(leg("Moneyline", { teamSide: "home" }), finalGame())).toBe("won");
    expect(settleMoneylinePick(leg("Moneyline", { teamSide: "away" }), finalGame())).toBe("lost");
  });

  it("stays pending until the game is final and voids postponed games", () => {
    expect(settleMoneylinePick(leg("Moneyline", { teamSide: "home" }), finalGame({ state: "live" }))).toBe("pending");
    expect(settleMoneylinePick(leg("Moneyline", { teamSide: "home" }), finalGame({ state: "postponed" }))).toBe("void");
  });
});

describe("settleBatterHitPick", () => {
  it("wins with 1+ hits and loses with 0 in official at-bats", () => {
    expect(settleBatterHitPick(leg("Batter to record a hit", { playerId: 100 }), finalGame())).toBe("won");
    expect(settleBatterHitPick(leg("Batter to record a hit", { playerId: 101 }), finalGame())).toBe("lost");
  });

  it("voids when the player never appeared in the final game", () => {
    expect(settleBatterHitPick(leg("Batter to record a hit", { playerId: 999 }), finalGame())).toBe("void");
  });
});

describe("settleBatterTotalBasesPick", () => {
  it("wins with 2+ total bases and loses below", () => {
    expect(settleBatterTotalBasesPick(leg("Batter 2+ total bases", { playerId: 100 }), finalGame())).toBe("won");
    expect(settleBatterTotalBasesPick(leg("Batter 2+ total bases", { playerId: 102 }), finalGame())).toBe("lost");
  });
});

describe("settlePitcherStrikeoutPick", () => {
  it("settles over/under against the strikeout line", () => {
    expect(
      settlePitcherStrikeoutPick(leg("Pitcher strikeouts over/under", { playerId: 200, line: 6.5, overUnder: "Over" }), finalGame())
    ).toBe("won");
    expect(
      settlePitcherStrikeoutPick(leg("Pitcher strikeouts over/under", { playerId: 200, line: 7.5, overUnder: "Over" }), finalGame())
    ).toBe("lost");
  });

  it("pushes (void) when a whole-number line lands exactly", () => {
    expect(
      settlePitcherStrikeoutPick(leg("Pitcher strikeouts over/under", { playerId: 200, line: 7, overUnder: "Over" }), finalGame())
    ).toBe("void");
  });

  it("voids when the pitcher never threw a pitch", () => {
    expect(
      settlePitcherStrikeoutPick(leg("Pitcher strikeouts over/under", { playerId: 999, line: 6.5, overUnder: "Over" }), finalGame())
    ).toBe("void");
  });
});

describe("totals settlement", () => {
  it("settles the full game total", () => {
    // 5 + 3 = 8 runs
    expect(settleFullGameTotalPick(leg("Full game total over/under", { line: 7.5, overUnder: "Over" }), finalGame())).toBe("won");
    expect(settleFullGameTotalPick(leg("Full game total over/under", { line: 8.5, overUnder: "Over" }), finalGame())).toBe("lost");
    expect(settleFullGameTotalPick(leg("Full game total over/under", { line: 8, overUnder: "Over" }), finalGame())).toBe("void");
  });

  it("settles the first-5 total once 5 innings are in the book", () => {
    // 3 + 1 = 4 runs through 5
    expect(settleFirstFiveTotalPick(leg("First 5 innings over/under", { line: 4.5, overUnder: "Under" }), finalGame())).toBe("won");
    expect(settleFirstFiveTotalPick(leg("First 5 innings over/under", { line: 3.5, overUnder: "Under" }), finalGame())).toBe("lost");
  });

  it("keeps the first-5 total pending while the game is early", () => {
    const early = finalGame({ state: "live", f5HomeRuns: null, f5AwayRuns: null });
    expect(settleFirstFiveTotalPick(leg("First 5 innings over/under", { line: 4.5, overUnder: "Under" }), early)).toBe("pending");
  });
});

describe("settleLeg + applySettlement", () => {
  it("dispatches by market", () => {
    expect(settleLeg(leg("Moneyline", { teamSide: "home" }), finalGame())).toBe("won");
    expect(settleLeg(leg("Batter to record a hit", { playerId: 101 }), finalGame())).toBe("lost");
  });

  it("recomputes full-parlay status after settling legs", () => {
    const parlay: StoredParlay = {
      id: "p1",
      date: "2026-06-12",
      type: "conservative",
      name: "Parlay A - Conservative",
      legs: [
        leg("Moneyline", { teamSide: "home" }),
        leg("Batter to record a hit", { playerId: 100 }),
        leg("Batter 2+ total bases", { playerId: 102 }),
      ],
      combinedOdds: 500,
      combinedDecimal: 6,
      modelProbability: 0.25,
      impliedProbability: 0.17,
      edge: 0.08,
      generatedAt: "2026-06-12T12:00:00Z",
      status: "PENDING",
      settledAt: null,
      resultReason: null,
    };

    const data = finalGame();
    const [settled] = applySettlement([parlay], (l) => settleLeg(l, data));
    // ML won, hit won, but the 2+ TB leg lost -> the whole parlay is LOST.
    expect(settled.status).toBe("LOST");
    expect(settled.resultReason).toBe("1 leg lost");
    expect(settled.legs.map((l) => l.result)).toEqual(["won", "won", "lost"]);
    expect(settled.settledAt).not.toBeNull();
  });

  it("does not resettle legs that already have a result", () => {
    const settledLeg = leg("Moneyline", { teamSide: "away", result: "won", settledAt: "2026-06-12T22:00:00Z" });
    const parlay: StoredParlay = {
      id: "p2",
      date: "2026-06-12",
      type: "balanced",
      name: "Parlay B - Balanced",
      legs: [settledLeg],
      combinedOdds: 100,
      combinedDecimal: 2,
      modelProbability: 0.55,
      impliedProbability: 0.5,
      edge: 0.05,
      generatedAt: "2026-06-12T12:00:00Z",
      status: "PENDING",
      settledAt: null,
      resultReason: null,
    };
    const [settled] = applySettlement([parlay], () => "lost");
    expect(settled.legs[0].result).toBe("won");
    expect(settled.status).toBe("WON");
  });
});
