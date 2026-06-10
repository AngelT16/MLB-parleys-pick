import { rawPickInputs } from "../mockData.js";
import type { ConfidenceLabel, Pick, RawPickInput } from "./types.js";

export function americanOddsToImpliedProbability(odds: number) {
  if (odds < 0) {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
  return 100 / (odds + 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function confidenceLabel(score: number, edge: number): ConfidenceLabel {
  if (score >= 86 && edge >= 0.055) return "Elite";
  if (score >= 76 && edge >= 0.035) return "Strong";
  if (score >= 64 && edge >= 0.018) return "Playable";
  return "Avoid / No Bet";
}

export function scorePick(input: RawPickInput): Pick {
  const modelProbability = clamp(
    input.baseProbability +
      input.recentForm * 0.075 +
      input.stadiumFit * 0.045 +
      input.handednessSplit * 0.05 +
      input.pitchTypeFit * 0.045 +
      input.weatherBoost * 0.025 +
      input.lineupBoost * 0.03 +
      input.oddsValue * 0.035 -
      input.riskPenalty * 0.06,
    0.05,
    0.86
  );
  const impliedProbability = americanOddsToImpliedProbability(input.odds);
  const edge = modelProbability - impliedProbability;
  const confidenceScore = Math.round(
    clamp(modelProbability * 72 + edge * 240 + (1 - input.riskPenalty) * 14, 1, 99)
  );

  return {
    id: input.id,
    playerId: input.playerId,
    market: input.market,
    selection: input.selection,
    game: input.game,
    gameId: input.gameId,
    player: input.player,
    team: input.team,
    odds: input.odds,
    impliedProbability: Number(impliedProbability.toFixed(4)),
    modelProbability: Number(modelProbability.toFixed(4)),
    edge: Number(edge.toFixed(4)),
    confidenceScore,
    confidenceLabel: confidenceLabel(confidenceScore, edge),
    reason: input.reason,
    dataPointsUsed: input.dataPointsUsed,
    riskNotes: input.riskNotes
  };
}

export function generatePickPool() {
  return rawPickInputs
    .map(scorePick)
    .sort((a, b) => b.edge + b.modelProbability * 0.2 - (a.edge + a.modelProbability * 0.2));
}
