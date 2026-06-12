import type { Batter, Game, Pitcher, PickLeg } from "../types.js";
import {
  americanOddsToImpliedProbability,
  calculateEdge,
  clampProbability,
  getConfidenceLabel,
  probabilityToAmericanOdds,
  round,
} from "./odds.js";

/** Deterministic pseudo-random in [0,1) from a string key, so mock odds are stable per player/day. */
function hashNoise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Simulate a sportsbook price for a prop: start from a slightly-off market
 * estimate of the true probability, then add vig. Noise is deterministic per
 * subject so the same pick always shows the same odds within a day.
 */
function marketOddsForProbability(modelProbability: number, key: string, vig = 0.04): number {
  const noise = (hashNoise(key) - 0.5) * 0.18; // market mispricing in [-9%, +9%]
  const marketTrueProb = clampProbability(modelProbability - noise, 0.05, 0.95);
  const withVig = clampProbability(marketTrueProb + vig, 0.05, 0.97);
  return probabilityToAmericanOdds(withVig);
}

function weatherOffenseMultiplier(game: Game): number {
  const w = game.weather;
  if (w.impact === "boost") return 1.04;
  if (w.impact === "suppress") return 0.95;
  return 1.0;
}

function gameLabel(game: Game): string {
  return `${game.away.abbr} @ ${game.home.abbr}`;
}

function expectedAtBats(lineupSpot: number): number {
  // Top of the order gets ~4.3 ABs, bottom ~3.5
  return 4.4 - (lineupSpot - 1) * 0.1;
}

interface ScoreContext {
  game: Game;
  /** The pitcher this batter faces */
  opposingPitcher: Pitcher;
  isHome: boolean;
}

function buildLeg(params: {
  id: string;
  market: PickLeg["market"];
  selection: string;
  game: Game;
  modelProbability: number;
  odds: number;
  confidenceScore: number;
  reason: string;
  dataPoints: string[];
  riskNote: string;
  subjectKey: string;
  playerId?: number;
  teamSide?: "home" | "away";
  line?: number;
  overUnder?: "Over" | "Under";
  batter?: Batter;
}): PickLeg {
  const implied = americanOddsToImpliedProbability(params.odds);
  const edge = calculateEdge(params.modelProbability, implied);
  const score = Math.max(0, Math.min(100, Math.round(params.confidenceScore)));
  return {
    id: params.id,
    market: params.market,
    selection: params.selection,
    gameId: params.game.id,
    game: gameLabel(params.game),
    odds: params.odds,
    impliedProbability: round(implied),
    modelProbability: round(params.modelProbability),
    edge: round(edge),
    confidenceScore: score,
    confidenceLabel: getConfidenceLabel(score),
    reason: params.reason,
    dataPoints: params.dataPoints,
    riskNote: params.riskNote,
    subjectKey: params.subjectKey,
    oddsSource: "mock",
    gamePk: params.game.gamePk,
    playerId: params.playerId,
    teamSide: params.teamSide,
    line: params.line,
    overUnder: params.overUnder,
    lineupStatus: params.batter?.lineupStatus,
    activeRoster: params.batter?.activeRoster,
    recentGamesPlayed: params.batter?.recentGamesPlayed,
    eligibilityReason: params.batter?.eligibilityReason,
  };
}

/** Probability a batter records at least one hit today. */
export function scoreHitPick(batter: Batter, ctx: ScoreContext): PickLeg {
  const { game, opposingPitcher: pitcher } = ctx;

  // Blend skill signals into a per-AB hit probability.
  let perAb =
    batter.avg * 0.3 +
    batter.xba * 0.3 +
    batter.last10.avg * 0.2 +
    pitcher.avgAllowed * 0.2;

  // Batter vs pitcher history (only meaningful with a real sample).
  if (batter.vsPitcher.atBats >= 8) {
    perAb = perAb * 0.85 + batter.vsPitcher.avg * 0.15;
  }

  // Contact profile: high contact / low K hitters convert more ABs into balls in play.
  perAb *= 1 + (batter.contactRate - 0.76) * 0.45;
  perAb *= 1 - (batter.kRate - 0.22) * 0.35;

  // Park, weather, recent form.
  perAb *= 1 + (game.stadium.hitFactor - 1) * 0.6;
  perAb *= weatherOffenseMultiplier(game) === 1 ? 1 : 1 + (weatherOffenseMultiplier(game) - 1) * 0.5;
  const formDelta = batter.last5.avg - batter.last15.avg;
  perAb *= 1 + Math.max(-0.05, Math.min(0.05, formDelta * 0.25));

  perAb = clampProbability(perAb, 0.12, 0.42);
  const abs = expectedAtBats(batter.lineupSpot);
  const pHit = clampProbability(1 - Math.pow(1 - perAb, abs), 0.45, 0.93);

  const odds = marketOddsForProbability(pHit, `hit:${batter.id}:${game.id}`, 0.05);
  const implied = americanOddsToImpliedProbability(odds);
  const edge = pHit - implied;

  let score = 50 + edge * 320 + (pHit - 0.68) * 90;
  if (game.lineupsConfirmed) score += 4;
  if (batter.vsPitcher.atBats >= 8 && batter.vsPitcher.avg >= 0.3) score += 4;
  if (batter.last5.avg >= 0.32) score += 3;
  if (batter.kRate > 0.27) score -= 4;

  return buildLeg({
    id: `hit-${batter.id}-${game.id}`,
    market: "Batter to record a hit",
    selection: `${batter.name} to record a hit`,
    game,
    modelProbability: pHit,
    odds,
    confidenceScore: score,
    reason:
      `Hitting ${batter.last5.avg.toFixed(3)} over his last 5 with a ${(batter.contactRate * 100).toFixed(0)}% contact rate, ` +
      `facing ${pitcher.name} (${pitcher.avgAllowed.toFixed(3)} AVG allowed) in a ${game.stadium.hitFactor >= 1 ? "hitter-friendly" : "pitcher-leaning"} park.`,
    dataPoints: [
      `Season AVG ${batter.avg.toFixed(3)} / xBA ${batter.xba.toFixed(3)}`,
      `L5 ${batter.last5.hits}-for-${batter.last5.atBats} (${batter.last5.avg.toFixed(3)}), L10 ${batter.last10.avg.toFixed(3)}, L15 ${batter.last15.avg.toFixed(3)}`,
      `vs ${pitcher.name}: ${batter.vsPitcher.hits}-for-${batter.vsPitcher.atBats}`,
      `Pitcher AVG allowed ${pitcher.avgAllowed.toFixed(3)}, K rate ${(batter.kRate * 100).toFixed(1)}%`,
      `Park hit factor ${game.stadium.hitFactor.toFixed(2)}, weather ${game.weather.condition} (${game.weather.impact})`,
      game.lineupsConfirmed ? "Lineup confirmed" : "Lineup projected (not confirmed)",
    ],
    riskNote: game.lineupsConfirmed
      ? batter.kRate > 0.26
        ? "Elevated strikeout rate adds some hitless-game risk."
        : "Low-variance market, but an early exit or pinch-hit situation voids value."
      : "Lineup not confirmed yet - verify before betting.",
    subjectKey: `player:${batter.id}`,
    playerId: batter.personId,
    batter,
  });
}

/** Probability a batter records 2+ total bases. */
export function scoreTwoTotalBasesPick(batter: Batter, ctx: ScoreContext): PickLeg {
  const { game, opposingPitcher: pitcher } = ctx;

  // Power-driven base rate from xSLG/ISO and contact quality.
  let p =
    0.18 +
    (batter.xslg - 0.4) * 0.55 +
    (batter.iso - 0.15) * 0.5 +
    (batter.hardHitPct - 0.38) * 0.35 +
    (batter.barrelPct - 0.07) * 0.6;

  // Opposing pitcher slugging allowed and park power factors.
  p += (pitcher.slgAllowed - 0.4) * 0.35;
  p *= 1 + (game.stadium.hrFactor - 1) * 0.5;

  // Recent total-base form (L10 TB per game vs a 1.5 baseline).
  const tbPerGame = batter.last10.totalBases / Math.max(1, batter.last10.games);
  p += (tbPerGame - 1.5) * 0.05;

  // Wind/weather matters more for extra-base hits.
  if (game.weather.windDirection === "out" && game.weather.windMph >= 10) p += 0.02;
  if (game.weather.windDirection === "in" && game.weather.windMph >= 10) p -= 0.025;
  if (game.weather.impact === "suppress") p -= 0.015;

  p = clampProbability(p, 0.18, 0.58);

  const odds = marketOddsForProbability(p, `2tb:${batter.id}:${game.id}`, 0.055);
  const implied = americanOddsToImpliedProbability(odds);
  const edge = p - implied;

  let score = 48 + edge * 300 + (p - 0.38) * 80;
  if (batter.barrelPct >= 0.11) score += 4;
  if (game.weather.windDirection === "out" && game.weather.windMph >= 10) score += 2;
  if (!game.lineupsConfirmed) score -= 5;

  return buildLeg({
    id: `2tb-${batter.id}-${game.id}`,
    market: "Batter 2+ total bases",
    selection: `${batter.name} 2+ total bases`,
    game,
    modelProbability: p,
    odds,
    confidenceScore: score,
    reason:
      `${(batter.hardHitPct * 100).toFixed(0)}% hard-hit and ${(batter.barrelPct * 100).toFixed(1)}% barrel rate vs ` +
      `${pitcher.name}, who allows a ${pitcher.slgAllowed.toFixed(3)} SLG; park HR factor ${game.stadium.hrFactor.toFixed(2)}.`,
    dataPoints: [
      `xSLG ${batter.xslg.toFixed(3)} / ISO ${batter.iso.toFixed(3)}`,
      `Hard hit ${(batter.hardHitPct * 100).toFixed(1)}%, barrel ${(batter.barrelPct * 100).toFixed(1)}%`,
      `L10 total bases: ${batter.last10.totalBases} (${tbPerGame.toFixed(1)}/game)`,
      `Pitcher SLG allowed ${pitcher.slgAllowed.toFixed(3)}`,
      `Park HR factor ${game.stadium.hrFactor.toFixed(2)}, wind ${game.weather.windMph} mph ${game.weather.windDirection}`,
    ],
    riskNote: "Higher variance than a hit prop - power outcomes swing day to day.",
    subjectKey: `player:${batter.id}`,
    playerId: batter.personId,
    batter,
  });
}

/** Pitcher strikeouts over/under vs the book line. Picks the stronger side. */
export function scorePitcherStrikeoutPick(pitcher: Pitcher, game: Game, opponent: { teamKRate: number; abbr: string }): PickLeg {
  // Expected Ks = batters faced approximation * blended K probability.
  const blendedKRate = pitcher.kRate * 0.65 + opponent.teamKRate * 0.35;
  const battersFaced = pitcher.projectedInnings * 4.25;
  let expectedKs = battersFaced * blendedKRate;

  // Recent K form and swing-and-miss quality.
  const recentAvg = pitcher.last3KCounts.reduce((a, b) => a + b, 0) / Math.max(1, pitcher.last3KCounts.length);
  expectedKs = expectedKs * 0.75 + recentAvg * 0.25;
  expectedKs *= 1 + (pitcher.whiffRate - 0.26) * 0.4;
  // Short leash lowers the ceiling.
  if (pitcher.avgPitchCount < 88) expectedKs *= 0.95;

  const line = pitcher.kLine;
  // Normal approximation around expected Ks (sd ~ 2.1 strikeouts).
  const sd = 2.1;
  const z = (line - expectedKs) / sd;
  const pOver = clampProbability(1 - normalCdf(z), 0.2, 0.8);

  const side = pOver >= 0.5 ? "Over" : "Under";
  const pSide = side === "Over" ? pOver : 1 - pOver;

  const odds = marketOddsForProbability(pSide, `k:${pitcher.id}:${game.id}:${side}`, 0.05);
  const implied = americanOddsToImpliedProbability(odds);
  const edge = pSide - implied;

  let score = 47 + edge * 300 + (pSide - 0.55) * 70;
  if (Math.abs(expectedKs - line) >= 1.0) score += 5;
  if (pitcher.avgPitchCount >= 95) score += 2;

  return buildLeg({
    id: `k-${pitcher.id}-${game.id}`,
    market: "Pitcher strikeouts over/under",
    selection: `${pitcher.name} ${side} ${line} strikeouts`,
    game,
    modelProbability: pSide,
    odds,
    confidenceScore: score,
    reason:
      `Model projects ${expectedKs.toFixed(1)} Ks vs a line of ${line}: ${(pitcher.kRate * 100).toFixed(1)}% K rate against a ` +
      `${opponent.abbr} lineup striking out ${(opponent.teamKRate * 100).toFixed(1)}% of the time over ${pitcher.projectedInnings.toFixed(1)} projected innings.`,
    dataPoints: [
      `Pitcher K rate ${(pitcher.kRate * 100).toFixed(1)}% / ${pitcher.kPer9.toFixed(1)} K/9`,
      `Opponent team K rate ${(opponent.teamKRate * 100).toFixed(1)}%`,
      `Last 3 starts: ${pitcher.last3KCounts.join(", ")} Ks`,
      `Whiff rate ${(pitcher.whiffRate * 100).toFixed(1)}%, avg pitch count ${pitcher.avgPitchCount}`,
      `Projected innings ${pitcher.projectedInnings.toFixed(1)}`,
    ],
    riskNote:
      side === "Over"
        ? "Early hook or high pitch count in short innings caps strikeout upside."
        : "A long outing or weak contact lineup could push Ks past the line.",
    subjectKey: `pitcher:${pitcher.id}`,
    playerId: pitcher.personId,
    line,
    overUnder: side,
  });
}

/** Moneyline pick: scores the stronger side of the game. */
export function scoreMoneylinePick(game: Game): PickLeg {
  const home = game.home;
  const away = game.away;
  const hp = game.homePitcher;
  const ap = game.awayPitcher;

  // Starting pitcher edge (ERA + WHIP + K rate), bullpen, recent offense, rest, home field.
  let homeScore = 0;
  homeScore += (ap.era - hp.era) * 0.045;
  homeScore += (ap.whip - hp.whip) * 0.1;
  homeScore += (hp.kRate - ap.kRate) * 0.5;
  homeScore += (away.bullpenEra - home.bullpenEra) * 0.03;
  homeScore += (home.offenseLast7 - away.offenseLast7) * 0.018;
  homeScore += (home.offenseLast14 - away.offenseLast14) * 0.012;
  homeScore += (home.restDays - away.restDays) * 0.01;
  homeScore += 0.035; // home-field advantage

  const pHome = clampProbability(0.5 + homeScore, 0.32, 0.72);

  const homeImplied = americanOddsToImpliedProbability(game.odds.homeML);
  const awayImplied = americanOddsToImpliedProbability(game.odds.awayML);
  const homeEdge = pHome - homeImplied;
  const awayEdge = 1 - pHome - awayImplied;

  const pickHome = homeEdge >= awayEdge;
  const team = pickHome ? home : away;
  const starter = pickHome ? hp : ap;
  const opponentStarter = pickHome ? ap : hp;
  const p = pickHome ? pHome : 1 - pHome;
  const odds = pickHome ? game.odds.homeML : game.odds.awayML;
  const implied = pickHome ? homeImplied : awayImplied;
  const edge = p - implied;

  let score = 50 + edge * 350 + (p - 0.55) * 60;
  if (starter.era < 3.3) score += 3;
  if (team.offenseLast7 > 5) score += 2;

  return buildLeg({
    id: `ml-${game.id}`,
    market: "Moneyline",
    selection: `${team.name} ML`,
    game,
    modelProbability: p,
    odds,
    confidenceScore: score,
    reason:
      `${starter.name} (${starter.era.toFixed(2)} ERA) holds the starting pitching edge over ${opponentStarter.name} ` +
      `(${opponentStarter.era.toFixed(2)} ERA), and ${team.abbr} is averaging ${team.offenseLast7.toFixed(1)} runs/game over the last 7 days.`,
    dataPoints: [
      `Starter ERA ${starter.era.toFixed(2)} vs ${opponentStarter.era.toFixed(2)}`,
      `Bullpen ERA: ${home.abbr} ${home.bullpenEra.toFixed(2)} / ${away.abbr} ${away.bullpenEra.toFixed(2)}`,
      `Offense L7: ${home.abbr} ${home.offenseLast7.toFixed(1)} rpg / ${away.abbr} ${away.offenseLast7.toFixed(1)} rpg`,
      `Rest: ${home.abbr} ${home.restDays}d / ${away.abbr} ${away.restDays}d`,
      pickHome ? "Home-field advantage applied" : "Road pick - no home-field bonus",
    ],
    riskNote: "Bullpen usage and late lineup changes can flip close games.",
    subjectKey: `team:${team.abbr}:${game.id}`,
    teamSide: pickHome ? "home" : "away",
  });
}

/** Full game total over/under pick. */
export function scoreGameTotalPick(game: Game): PickLeg {
  const parkRun = game.stadium.runFactor;
  const baseRuns =
    (game.home.offenseLast14 + game.away.offenseLast14) * 0.52 +
    (game.homePitcher.era + game.awayPitcher.era) * 0.42 +
    (game.home.bullpenEra + game.away.bullpenEra) * 0.18;

  let projectedTotal = baseRuns * parkRun;
  projectedTotal *= weatherOffenseMultiplier(game);
  if (game.weather.windDirection === "out" && game.weather.windMph >= 12) projectedTotal += 0.4;
  if (game.weather.windDirection === "in" && game.weather.windMph >= 12) projectedTotal -= 0.4;

  const line = game.odds.total;
  const sd = 2.6;
  const z = (line - projectedTotal) / sd;
  const pOver = clampProbability(1 - normalCdf(z), 0.3, 0.7);

  const side = pOver >= 0.5 ? "Over" : "Under";
  const pSide = side === "Over" ? pOver : 1 - pOver;
  const odds = side === "Over" ? game.odds.overOdds : game.odds.underOdds;
  const implied = americanOddsToImpliedProbability(odds);
  const edge = pSide - implied;

  let score = 46 + edge * 320 + (pSide - 0.54) * 70;
  if (Math.abs(projectedTotal - line) >= 0.8) score += 4;

  return buildLeg({
    id: `total-${game.id}`,
    market: "Full game total over/under",
    selection: `${side} ${line} runs`,
    game,
    modelProbability: pSide,
    odds,
    confidenceScore: score,
    reason:
      `Model projects ${projectedTotal.toFixed(1)} runs vs a line of ${line} given recent offense, ` +
      `both starters' ERA, park run factor ${parkRun.toFixed(2)} and ${game.weather.condition.toLowerCase()} conditions.`,
    dataPoints: [
      `Projected total ${projectedTotal.toFixed(1)} vs line ${line}`,
      `Offense L14: ${game.home.abbr} ${game.home.offenseLast14.toFixed(1)} / ${game.away.abbr} ${game.away.offenseLast14.toFixed(1)} rpg`,
      `Starters ERA ${game.homePitcher.era.toFixed(2)} & ${game.awayPitcher.era.toFixed(2)}`,
      `Park run factor ${parkRun.toFixed(2)}`,
      `Weather: ${game.weather.condition}, wind ${game.weather.windMph} mph ${game.weather.windDirection}`,
    ],
    riskNote: "Totals carry bullpen and umpire-zone variance; weather can shift pregame.",
    subjectKey: `total:${game.id}`,
    line,
    overUnder: side,
  });
}

/** First 5 innings total over/under pick (starters only). */
export function scoreFirstFiveTotalPick(game: Game): PickLeg {
  const parkRun = game.stadium.runFactor;
  let projected =
    ((game.home.offenseLast14 + game.away.offenseLast14) * 0.3 +
      (game.homePitcher.era + game.awayPitcher.era) * 0.32) *
    parkRun;
  projected *= weatherOffenseMultiplier(game);

  const line = game.odds.f5Total;
  const sd = 1.8;
  const z = (line - projected) / sd;
  const pOver = clampProbability(1 - normalCdf(z), 0.3, 0.7);

  const side = pOver >= 0.5 ? "Over" : "Under";
  const pSide = side === "Over" ? pOver : 1 - pOver;
  const odds = side === "Over" ? game.odds.f5OverOdds : game.odds.f5UnderOdds;
  const implied = americanOddsToImpliedProbability(odds);
  const edge = pSide - implied;

  let score = 45 + edge * 320 + (pSide - 0.54) * 70;
  if (Math.abs(projected - line) >= 0.6) score += 4;

  return buildLeg({
    id: `f5-${game.id}`,
    market: "First 5 innings over/under",
    selection: `First 5 ${side} ${line} runs`,
    game,
    modelProbability: pSide,
    odds,
    confidenceScore: score,
    reason:
      `Starter-driven projection of ${projected.toFixed(1)} runs through 5 vs a ${line} line ` +
      `(${game.homePitcher.name} ${game.homePitcher.era.toFixed(2)} ERA, ${game.awayPitcher.name} ${game.awayPitcher.era.toFixed(2)} ERA).`,
    dataPoints: [
      `F5 projection ${projected.toFixed(1)} vs line ${line}`,
      `Starters ERA ${game.homePitcher.era.toFixed(2)} & ${game.awayPitcher.era.toFixed(2)}`,
      `Park run factor ${parkRun.toFixed(2)}`,
      `Weather impact: ${game.weather.impact}`,
    ],
    riskNote: "Removes bullpen variance but a single big inning decides the bet.",
    subjectKey: `f5:${game.id}`,
    line,
    overUnder: side,
  });
}

/** Standard normal CDF (Abramowitz & Stegun approximation). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}
