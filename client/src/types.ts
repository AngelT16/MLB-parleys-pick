export type ConfidenceLabel = "Elite" | "Strong" | "Playable" | "Avoid / No Bet";

export type Pick = {
  id: string;
  market: string;
  selection: string;
  game: string;
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
  riskRating: string;
};

export type Game = {
  id: string;
  awayTeam: string;
  homeTeam: string;
  venue: string;
  startTime: string;
  probablePitchers: { away: string; home: string };
  weather: { temp: number; wind: string; impact: string };
  lineupsConfirmed: boolean;
  total: number;
};

export type TwoHitCandidate = {
  player: string;
  team: string;
  opponent: string;
  opposingPitcher: string;
  estimatedProbability: number;
  edge: number;
  confidence: ConfidenceLabel;
  last5: string;
  last10: string;
  last15: string;
  stadiumHistory: string;
  avg: number;
  obp: number;
  contactRate: number;
  kRate: number;
  reason: string;
};
