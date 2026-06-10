export type ConfidenceLabel = "Elite" | "Strong" | "Playable" | "Avoid / No Bet";

export type Market =
  | "Moneyline"
  | "Batter to record a hit"
  | "Batter 2+ total bases"
  | "Pitcher strikeouts over/under"
  | "First 5 innings over/under"
  | "Full game total over/under";

export type Pick = {
  id: string;
  playerId?: string;
  market: Market;
  selection: string;
  game: string;
  gameId: string;
  player?: string;
  team?: string;
  odds: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  reason: string;
  dataPointsUsed: string[];
  riskNotes: string[];
};

export type Parlay = {
  id: string;
  name: string;
  profile: "Conservative" | "Balanced" | "Aggressive";
  legs: Pick[];
  estimatedProbability: number;
  combinedOdds: number;
  projectedEdge: number;
  riskRating: "Low" | "Medium" | "High";
};

export type RawPickInput = {
  id: string;
  playerId?: string;
  market: Market;
  selection: string;
  game: string;
  gameId: string;
  player?: string;
  team?: string;
  odds: number;
  baseProbability: number;
  recentForm: number;
  stadiumFit: number;
  handednessSplit: number;
  pitchTypeFit: number;
  weatherBoost: number;
  lineupBoost: number;
  oddsValue: number;
  riskPenalty: number;
  reason: string;
  dataPointsUsed: string[];
  riskNotes: string[];
};
