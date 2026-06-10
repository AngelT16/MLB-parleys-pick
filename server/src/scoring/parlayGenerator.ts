import type { Parlay, Pick } from "./types.js";

type Profile = Parlay["profile"];

const profileConfig: Record<Profile, { name: string; minScore: number; risk: Parlay["riskRating"]; sort: (pick: Pick) => number }> = {
  Conservative: {
    name: "Parlay A Conservative",
    minScore: 76,
    risk: "Low",
    sort: (pick) => pick.modelProbability * 1.25 + pick.edge * 1.7 - Math.max(0, pick.odds) / 6000
  },
  Balanced: {
    name: "Parlay B Balanced",
    minScore: 70,
    risk: "Medium",
    sort: (pick) => pick.modelProbability * 0.8 + pick.edge * 2.2 + Math.max(0, pick.odds) / 8000
  },
  Aggressive: {
    name: "Parlay C Aggressive",
    minScore: 64,
    risk: "High",
    sort: (pick) => pick.edge * 2.8 + Math.max(0, pick.odds) / 2600 + pick.modelProbability * 0.35
  }
};

function decimalOdds(odds: number) {
  return odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
}

function americanFromDecimal(decimal: number) {
  return Math.round((decimal - 1) * 100);
}

function buildParlay(pool: Pick[], profile: Profile, usedPlayerCounts: Map<string, number>): Parlay {
  const config = profileConfig[profile];
  const gameCounts = new Map<string, number>();
  const legs: Pick[] = [];

  const sorted = [...pool]
    .filter((pick) => pick.edge > 0.018 && pick.confidenceScore >= config.minScore && pick.confidenceLabel !== "Avoid / No Bet")
    .sort((a, b) => config.sort(b) - config.sort(a));

  for (const pick of sorted) {
    const currentGameCount = gameCounts.get(pick.gameId) ?? 0;
    const playerRepeats = pick.player ? (usedPlayerCounts.get(pick.player) ?? 0) : 0;
    const sameGameLimit = profile === "Aggressive" ? 3 : 2;

    if (legs.length >= 10) break;
    if (currentGameCount >= sameGameLimit) continue;
    if (playerRepeats >= 2) continue;
    if (legs.some((leg) => leg.player && leg.player === pick.player)) continue;
    if (profile !== "Aggressive" && pick.riskNotes.length > 1 && pick.confidenceScore < 82) continue;

    legs.push(pick);
    gameCounts.set(pick.gameId, currentGameCount + 1);
    if (pick.player) usedPlayerCounts.set(pick.player, playerRepeats + 1);
  }

  const probability = legs.reduce((acc, leg) => acc * leg.modelProbability, 1);
  const decimal = legs.reduce((acc, leg) => acc * decimalOdds(leg.odds), 1);
  const averageEdge = legs.length ? legs.reduce((sum, leg) => sum + leg.edge, 0) / legs.length : 0;

  return {
    id: profile.toLowerCase(),
    name: config.name,
    profile,
    legs,
    estimatedProbability: Number(probability.toFixed(4)),
    combinedOdds: americanFromDecimal(decimal),
    projectedEdge: Number(averageEdge.toFixed(4)),
    riskRating: config.risk
  };
}

export function generateDailyParlays(pool: Pick[]): Parlay[] {
  const usedPlayerCounts = new Map<string, number>();
  return (["Conservative", "Balanced", "Aggressive"] as const).map((profile) =>
    buildParlay(pool, profile, usedPlayerCounts)
  );
}
