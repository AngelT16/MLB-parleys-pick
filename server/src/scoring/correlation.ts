import type { PickLeg } from "../types.js";

export interface CorrelationResult {
  /** Candidate confidence score after penalty (may be unchanged) */
  adjustedScore: number;
  /** Hard block: never combine these legs */
  blocked: boolean;
  note?: string;
}

function isBatterMarket(leg: PickLeg): boolean {
  return leg.market === "Batter to record a hit" || leg.market === "Batter 2+ total bases";
}

function isUnderSelection(leg: PickLeg): boolean {
  return /under/i.test(leg.selection);
}

function isTotalMarket(leg: PickLeg): boolean {
  return leg.market === "Full game total over/under" || leg.market === "First 5 innings over/under";
}

/**
 * Evaluate a candidate leg against legs already in the parlay.
 *
 * - Same player twice: blocked.
 * - Two totals on the same game: blocked.
 * - Negative correlation (e.g. game Under + batter props in that game,
 *   pitcher K Over + opposing batter props): score penalty, and blocked
 *   entirely when correlation is disallowed in settings.
 * - Positive correlation (Over + batter props, ML + same-team batter):
 *   small penalty when correlation is disallowed, allowed when enabled.
 */
export function applyCorrelationPenalty(
  existingLegs: PickLeg[],
  candidate: PickLeg,
  allowCorrelation: boolean
): CorrelationResult {
  let score = candidate.confidenceScore;
  let note: string | undefined;

  for (const leg of existingLegs) {
    // Never duplicate the same subject (same player / same total / same game side).
    if (leg.subjectKey === candidate.subjectKey) {
      return { adjustedScore: 0, blocked: true, note: "Duplicate subject" };
    }

    if (leg.gameId !== candidate.gameId) continue;

    const pair = [leg, candidate];
    const total = pair.find(isTotalMarket);
    const batter = pair.find(isBatterMarket);
    const kProp = pair.find((l) => l.market === "Pitcher strikeouts over/under");
    const moneyline = pair.find((l) => l.market === "Moneyline");

    // Two totals in one game (full game + F5) are near-duplicates.
    if (isTotalMarket(leg) && isTotalMarket(candidate)) {
      return { adjustedScore: 0, blocked: true, note: "Two totals on the same game" };
    }

    // Negative correlation: Under + batter offense in the same game.
    if (total && batter && isUnderSelection(total)) {
      if (!allowCorrelation) return { adjustedScore: 0, blocked: true, note: "Under vs batter prop conflict" };
      score -= 12;
      note = "Penalized: game Under conflicts with batter offense in the same game";
    }

    // Negative correlation: pitcher K Over implies weak contact vs opposing batter hit props.
    if (kProp && batter && !isUnderSelection(kProp)) {
      if (!allowCorrelation) return { adjustedScore: 0, blocked: true, note: "K Over vs batter prop conflict" };
      score -= 8;
      note = "Penalized: pitcher K Over works against opposing batter contact";
    }

    // Positive correlation: Over + batter props, or ML + batter from same game.
    if ((total && batter && !isUnderSelection(total)) || (moneyline && batter)) {
      if (!allowCorrelation) {
        score -= 6;
        note = "Penalized: correlated same-game legs (correlation disabled in settings)";
      } else {
        score -= 2;
        note = "Mild stack penalty: correlated same-game legs allowed";
      }
    }

    // Generic same-game crowding penalty.
    if (!note) {
      score -= 2;
    }
  }

  return { adjustedScore: Math.max(0, score), blocked: false, note };
}
