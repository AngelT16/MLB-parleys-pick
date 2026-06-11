import type { ConfidenceLabel } from "../types.js";

/** Convert American odds (-150, +120) to implied probability (0-1, includes vig). */
export function americanOddsToImpliedProbability(odds: number): number {
  if (odds === 0) throw new Error("American odds cannot be 0");
  if (odds < 0) return -odds / (-odds + 100);
  return 100 / (odds + 100);
}

/** Convert American odds to decimal odds. */
export function americanToDecimal(odds: number): number {
  if (odds === 0) throw new Error("American odds cannot be 0");
  return odds < 0 ? 1 + 100 / -odds : 1 + odds / 100;
}

/** Convert decimal odds to American odds. */
export function decimalToAmerican(decimal: number): number {
  if (decimal <= 1) throw new Error("Decimal odds must be > 1");
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

/** Fair American odds for a probability (no vig). */
export function probabilityToAmericanOdds(probability: number): number {
  const p = clampProbability(probability);
  return decimalToAmerican(1 / p);
}

/** Edge = model probability - market implied probability. */
export function calculateEdge(modelProbability: number, impliedProbability: number): number {
  return modelProbability - impliedProbability;
}

/** Map a 0-100 confidence score to a label. */
export function getConfidenceLabel(score: number): ConfidenceLabel {
  if (score >= 80) return "Elite";
  if (score >= 68) return "Strong";
  if (score >= 55) return "Playable";
  return "Avoid";
}

export function clampProbability(p: number, min = 0.02, max = 0.97): number {
  return Math.min(max, Math.max(min, p));
}

export function round(value: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
