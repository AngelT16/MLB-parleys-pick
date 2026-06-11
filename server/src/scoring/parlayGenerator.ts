import type { AppSettings, Parlay, PickLeg, RiskMode } from "../types.js";
import { applyCorrelationPenalty } from "./correlation.js";
import { americanToDecimal, decimalToAmerican, round } from "./odds.js";

interface ProfileConfig {
  type: RiskMode;
  name: string;
  minProbability: number;
  minEdge: number;
  sortKey: (leg: PickLeg) => number;
}

const PROFILES: ProfileConfig[] = [
  {
    type: "conservative",
    name: "Parlay A - Conservative",
    minProbability: 0.6,
    minEdge: 0.01,
    // Highest probability first; edge breaks ties.
    sortKey: (l) => l.modelProbability * 100 + l.edge * 40,
  },
  {
    type: "balanced",
    name: "Parlay B - Balanced",
    minProbability: 0.5,
    minEdge: 0.015,
    // Blend of confidence, probability and payout.
    sortKey: (l) => l.confidenceScore + l.modelProbability * 30 + l.edge * 120,
  },
  {
    type: "aggressive",
    name: "Parlay C - Aggressive",
    minProbability: 0.4,
    minEdge: 0.02,
    // Edge-weighted payout hunting, still requires positive edge.
    sortKey: (l) => l.edge * 250 + americanToDecimal(l.odds) * 12 + l.confidenceScore * 0.3,
  },
];

function combineLegs(legs: PickLeg[], type: RiskMode, name: string): Parlay {
  const combinedDecimal = legs.reduce((acc, l) => acc * americanToDecimal(l.odds), 1);
  const modelProbability = legs.reduce((acc, l) => acc * l.modelProbability, 1);
  const impliedProbability = 1 / combinedDecimal;
  return {
    id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    type,
    name,
    legs,
    combinedOdds: decimalToAmerican(combinedDecimal),
    combinedDecimal: round(combinedDecimal, 2),
    modelProbability: round(modelProbability),
    impliedProbability: round(impliedProbability),
    edge: round(modelProbability - impliedProbability),
    generatedAt: new Date().toISOString(),
  };
}

function buildParlayForProfile(pool: PickLeg[], profile: ProfileConfig, settings: AppSettings): Parlay {
  const minProbability = Math.max(profile.minProbability, settings.minProbability);
  const minEdge = Math.max(profile.minEdge, settings.minEdge);

  const eligible = pool
    .filter((l) => l.confidenceLabel !== "Avoid")
    .filter((l) => l.modelProbability >= minProbability)
    .filter((l) => l.edge >= minEdge)
    .sort((a, b) => profile.sortKey(b) - profile.sortKey(a));

  const chosen: PickLeg[] = [];
  const perGame = new Map<string, number>();

  for (const candidate of eligible) {
    if (chosen.length >= settings.maxLegs) break;

    const gameCount = perGame.get(candidate.gameId) ?? 0;
    if (gameCount >= settings.maxPicksPerGame) continue;

    const { adjustedScore, blocked } = applyCorrelationPenalty(chosen, candidate, settings.allowCorrelation);
    if (blocked) continue;
    // Allow correlated legs only while they still grade as playable after the penalty.
    if (adjustedScore < 55) continue;

    chosen.push(candidate);
    perGame.set(candidate.gameId, gameCount + 1);
  }

  // Never pad with bad picks: if we cannot reach minLegs with edge-positive
  // selections, ship the best parlay we have rather than inventing legs.
  return combineLegs(chosen, profile.type, profile.name);
}

/**
 * Generate the three daily parlays (conservative / balanced / aggressive)
 * from a scored pick pool. Only edge-positive, non-Avoid picks are used;
 * markets are never forced - the best board wins regardless of market mix.
 */
export function generateParlays(pool: PickLeg[], settings: AppSettings): Parlay[] {
  return PROFILES.map((profile) => buildParlayForProfile(pool, profile, settings));
}
