export type Market =
  | "Moneyline"
  | "Batter to record a hit"
  | "Batter 2+ total bases"
  | "Pitcher strikeouts over/under"
  | "First 5 innings over/under"
  | "Full game total over/under";

export type ConfidenceLabel = "Elite" | "Strong" | "Playable" | "Avoid";
export type RiskMode = "conservative" | "balanced" | "aggressive";

export type LineupStatus = "CONFIRMED" | "PROJECTED_REGULAR" | "PENDING" | "EXCLUDED";
export type OddsSource = "mock" | "live";
export type DataSource = "mlb-official" | "mock";
export type LegResult = "pending" | "won" | "lost" | "void";
export type ParlayStatus = "PENDING" | "WON" | "LOST" | "VOID";

export interface Team {
  id: string;
  abbr: string;
  name: string;
  city: string;
  offenseLast7: number;
  offenseLast14: number;
  bullpenEra: number;
  teamKRate: number;
  restDays: number;
}

export interface Stadium {
  id: string;
  name: string;
  teamAbbr: string;
  hitFactor: number;
  runFactor: number;
  hrFactor: number;
  roof: "open" | "dome" | "retractable";
}

export interface Weather {
  tempF: number;
  windMph: number;
  windDirection: "out" | "in" | "cross" | "calm";
  condition: string;
  impact: "boost" | "neutral" | "suppress";
}

export interface Pitcher {
  id: string;
  name: string;
  teamAbbr: string;
  throws: "L" | "R";
  era: number;
  whip: number;
  kRate: number;
  kPer9: number;
  avgAllowed: number;
  slgAllowed: number;
  whiffRate: number;
  avgPitchCount: number;
  projectedInnings: number;
  last3KCounts: number[];
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
  subjectKey: string;
  oddsSource?: OddsSource;
  gamePk?: number;
  playerId?: number;
  teamSide?: "home" | "away";
  line?: number;
  overUnder?: "Over" | "Under";
  lineupStatus?: LineupStatus;
  activeRoster?: boolean;
  recentGamesPlayed?: number;
  eligibilityReason?: string;
  /** Present once the leg has been settled (stored official parlays) */
  result?: LegResult;
  settledAt?: string | null;
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
  /** Present on stored official daily parlays */
  date?: string;
  status?: ParlayStatus;
  settledAt?: string | null;
  resultReason?: string | null;
}

export interface ParlayTypeRecord {
  type: RiskMode;
  wins: number;
  losses: number;
  pending: number;
  voids: number;
  winRate: number;
}

/** Model performance measured on FULL parlays - never leg by leg. */
export interface ParlayPerformanceData {
  record: { wins: number; losses: number; pending: number; voids: number };
  winRate: number;
  roi: number;
  avgClv: number | null;
  byType: ParlayTypeRecord[];
  totalParlays: number;
  lastSettledAt: string | null;
}

export interface DataStatus {
  source: DataSource;
  oddsSource: OddsSource;
  mockMode: boolean;
  officialApiOk: boolean;
  date: string;
  totalGames: number;
  lineupsConfirmed: number;
  projectedRegularsUsed: number;
  lastSync: string | null;
  officialError: string | null;
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

export interface ModelPerformanceData {
  record: { wins: number; losses: number; pending: number; voids: number };
  winRate: number;
  roi: number;
  avgClv: number;
  last30: { date: string; winRate: number }[];
  byMarket: MarketPerformance[];
  lastModelUpdate: string;
}

export interface PlayerMatchup {
  batter: Batter;
  game: { id: string; label: string; startTimeET: string; lineupsConfirmed: boolean };
  opposingPitcher: Pitcher;
  stadium: Stadium;
  weather: Weather;
}

export interface StadiumSplitsData {
  stadium: Stadium;
  todayGame: string | null;
  weather: Weather | null;
  splits: {
    hitFactor: number;
    runFactor: number;
    hrFactor: number;
    notes: string;
  };
}
