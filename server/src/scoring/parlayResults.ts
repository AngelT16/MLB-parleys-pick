import type {
  LegResult,
  ParlayPerformance,
  ParlayStatus,
  ParlayTypeRecord,
  RiskMode,
  StoredParlay,
  StoredParlayLeg,
} from "../types.js";
import { americanToDecimal } from "./odds.js";

/**
 * Full-parlay status rules:
 * - any leg lost      -> LOST (a single losing leg kills the parlay, even with legs pending)
 * - any leg pending   -> PENDING
 * - any leg won       -> WON (void/push legs are removed, payout adjusts)
 * - all legs void     -> VOID (no action)
 */
export function calculateParlayStatus(legs: Array<{ result: LegResult }>): ParlayStatus {
  if (legs.length === 0) return "VOID";
  if (legs.some((l) => l.result === "lost")) return "LOST";
  if (legs.some((l) => l.result === "pending")) return "PENDING";
  if (legs.some((l) => l.result === "won")) return "WON";
  return "VOID";
}

/** Payout multiplier with void/push legs removed ("parlay WON ajustado"). */
export function adjustedDecimalOdds(legs: StoredParlayLeg[]): number {
  return legs
    .filter((l) => l.result === "won")
    .reduce((acc, l) => acc * americanToDecimal(l.odds), 1);
}

export function describeParlayResult(status: ParlayStatus, legs: StoredParlayLeg[]): string {
  const lost = legs.filter((l) => l.result === "lost").length;
  const pending = legs.filter((l) => l.result === "pending").length;
  const voids = legs.filter((l) => l.result === "void").length;
  const won = legs.filter((l) => l.result === "won").length;
  switch (status) {
    case "LOST":
      return `${lost} leg${lost === 1 ? "" : "s"} lost`;
    case "WON":
      return voids > 0 ? `All ${won} live legs won (${voids} void)` : `All ${won} legs won`;
    case "VOID":
      return "All legs void/pushed - no action";
    case "PENDING":
      return `${pending} of ${legs.length} legs pending`;
  }
}

/** Win rate over FULL parlays: wins / (wins + losses). Voids and pendings excluded. */
export function calculateParlayWinRate(parlays: StoredParlay[]): number {
  const wins = parlays.filter((p) => p.status === "WON").length;
  const losses = parlays.filter((p) => p.status === "LOST").length;
  const settled = wins + losses;
  return settled > 0 ? Math.round((wins / settled) * 1000) / 10 : 0;
}

/**
 * ROI over FULL parlays at flat 1-unit stakes. A won parlay returns its
 * void-adjusted decimal odds; a lost parlay loses the stake; voids return it.
 */
export function calculateParlayRoi(parlays: StoredParlay[]): number {
  let staked = 0;
  let profit = 0;
  for (const p of parlays) {
    if (p.status === "WON") {
      staked += 1;
      profit += adjustedDecimalOdds(p.legs) - 1;
    } else if (p.status === "LOST") {
      staked += 1;
      profit -= 1;
    }
  }
  return staked > 0 ? Math.round((profit / staked) * 1000) / 10 : 0;
}

export function calculateParlayRecordByType(parlays: StoredParlay[]): ParlayTypeRecord[] {
  const types: RiskMode[] = ["conservative", "balanced", "aggressive"];
  return types.map((type) => {
    const ofType = parlays.filter((p) => p.type === type);
    const wins = ofType.filter((p) => p.status === "WON").length;
    const losses = ofType.filter((p) => p.status === "LOST").length;
    const pending = ofType.filter((p) => p.status === "PENDING").length;
    const voids = ofType.filter((p) => p.status === "VOID").length;
    const settled = wins + losses;
    return {
      type,
      wins,
      losses,
      pending,
      voids,
      winRate: settled > 0 ? Math.round((wins / settled) * 1000) / 10 : 0,
    };
  });
}

/** Headline model performance, measured on full parlays - never leg by leg. */
export function buildParlayPerformance(parlays: StoredParlay[]): ParlayPerformance {
  const settledAts = parlays.map((p) => p.settledAt).filter((s): s is string => Boolean(s));
  return {
    record: {
      wins: parlays.filter((p) => p.status === "WON").length,
      losses: parlays.filter((p) => p.status === "LOST").length,
      pending: parlays.filter((p) => p.status === "PENDING").length,
      voids: parlays.filter((p) => p.status === "VOID").length,
    },
    winRate: calculateParlayWinRate(parlays),
    roi: calculateParlayRoi(parlays),
    avgClv: null, // no live odds feed yet, so no closing line value
    byType: calculateParlayRecordByType(parlays),
    totalParlays: parlays.length,
    lastSettledAt: settledAts.length > 0 ? settledAts.sort().at(-1) ?? null : null,
  };
}
