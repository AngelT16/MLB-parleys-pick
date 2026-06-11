export type Market =
  | "Moneyline"
  | "Batter to record a hit"
  | "Batter 2+ total bases"
  | "Pitcher strikeouts over/under"
  | "First 5 innings over/under"
  | "Full game total over/under";

export type ConfidenceLabel = "Elite" | "Strong" | "Playable" | "Avoid";

export type RiskMode = "conservative" | "balanced" | "aggressive";

export interface Team {
  id: string;
  abbr: string;
  name: string;
  city: string;
  /** Runs per game over the last 7 days */
  offenseLast7: number;
  /** Runs per game over the last 14 days */
  offenseLast14: number;
  /** Bullpen ERA */
  bullpenEra: number;
  /** Team strikeout rate vs pitchers (0-1) */
  teamKRate: number;
  /** Days of rest before today's game */
  restDays: number;
}

export interface Stadium {
  id: string;
  name: string;
  teamAbbr: string;
  /** Park factor for hits (1.00 = neutral) */
  hitFactor: number;
  /** Park factor for runs (1.00 = neutral) */
  runFactor: number;
  /** Park factor for home runs (1.00 = neutral) */
  hrFactor: number;
  roof: "open" | "dome" | "retractable";
}

export interface Weather {
  tempF: number;
  windMph: number;
  windDirection: "out" | "in" | "cross" | "calm";
  condition: "Clear" | "Cloudy" | "Light Rain" | "Hot" | "Dome";
  /** Net effect on offense */
  impact: "boost" | "neutral" | "suppress";
}

export interface Pitcher {
  id: string;
  name: string;
  teamAbbr: string;
  throws: "L" | "R";
  era: number;
  whip: number;
  /** Strikeout rate (0-1) */
  kRate: number;
  kPer9: number;
  /** Batting average allowed */
  avgAllowed: number;
  /** Slugging allowed */
  slgAllowed: number;
  whiffRate: number;
  avgPitchCount: number;
  projectedInnings: number;
  /** Strikeouts in last 3 starts */
  last3KCounts: number[];
  /** Sportsbook strikeout line for today */
  kLine: number;
}

export interface BatterWindow {
  games: number;
  hits: number;
  atBats: number;
  avg: number;
  totalBases: number;
}

export interface Batter {
  id: string;
  name: string;
  teamAbbr: string;
  bats: "L" | "R" | "S";
  position: string;
  lineupSpot: number;
  avg: number;
  obp: number;
  slg: number;
  iso: number;
  xba: number;
  xslg: number;
  contactRate: number;
  kRate: number;
  hardHitPct: number;
  barrelPct: number;
  last5: BatterWindow;
  last10: BatterWindow;
  last15: BatterWindow;
  vsPitcher: { atBats: number; hits: number; avg: number; homeRuns: number };
  /** Career AVG at today's stadium */
  stadiumAvg: number;
  stadiumGames: number;
}

export interface GameOdds {
  homeML: number;
  awayML: number;
  total: number;
  overOdds: number;
  underOdds: number;
  f5Total: number;
  f5OverOdds: number;
  f5UnderOdds: number;
}

export interface Game {
  id: string;
  date: string;
  startTimeET: string;
  home: Team;
  away: Team;
  stadium: Stadium;
  weather: Weather;
  homePitcher: Pitcher;
  awayPitcher: Pitcher;
  homeLineup: Batter[];
  awayLineup: Batter[];
  lineupsConfirmed: boolean;
  odds: GameOdds;
}

export interface PickLeg {
  id: string;
  market: Market;
  selection: string;
  gameId: string;
  game: string;
  odds: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  reason: string;
  dataPoints: string[];
  riskNote: string;
  /** Internal: player/team key used for correlation checks */
  subjectKey: string;
}

export interface Parlay {
  id: string;
  type: RiskMode;
  name: string;
  legs: PickLeg[];
  combinedOdds: number;
  combinedDecimal: number;
  modelProbability: number;
  impliedProbability: number;
  edge: number;
  generatedAt: string;
}

export interface TwoHitCandidate {
  playerId: string;
  player: string;
  team: string;
  opponent: string;
  opposingPitcher: string;
  estimatedProbability: number;
  edge: number;
  confidenceScore: number;
  confidenceLabel: ConfidenceLabel;
  last5: string;
  last10: string;
  last15: string;
  stadiumHistory: string;
  avg: number;
  obp: number;
  contactRate: number;
  kRate: number;
  reason: string;
}

export interface AppSettings {
  minLegs: number;
  maxLegs: number;
  minProbability: number;
  minEdge: number;
  maxPicksPerGame: number;
  allowCorrelation: boolean;
  excludeUnconfirmedLineups: boolean;
  riskMode: RiskMode;
}

export interface TrackedBet {
  id: string;
  date: string;
  market: Market;
  selection: string;
  game: string;
  odds: number;
  closingOdds: number;
  clv: number;
  result: "pending" | "won" | "lost" | "void";
}

export interface MarketPerformance {
  market: Market;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  roi: number;
  avgClv: number;
}

export interface ModelPerformance {
  record: { wins: number; losses: number; pending: number; voids: number };
  winRate: number;
  roi: number;
  avgClv: number;
  last30: { date: string; winRate: number }[];
  byMarket: MarketPerformance[];
  lastModelUpdate: string;
}
