import { Router } from "express";
import { z } from "zod";
import { buildMockDay, type MockDay } from "./mockData.js";
import {
  americanOddsToImpliedProbability,
  clampProbability,
  getConfidenceLabel,
  probabilityToAmericanOdds,
  round,
} from "./scoring/odds.js";
import {
  scoreFirstFiveTotalPick,
  scoreGameTotalPick,
  scoreHitPick,
  scoreMoneylinePick,
  scorePitcherStrikeoutPick,
  scoreTwoTotalBasesPick,
} from "./scoring/scoringEngine.js";
import { generateParlays } from "./scoring/parlayGenerator.js";
import type { AppSettings, Batter, Game, Parlay, PickLeg, TwoHitCandidate } from "./types.js";

const DEFAULT_SETTINGS: AppSettings = {
  minLegs: 8,
  maxLegs: 10,
  minProbability: 0.4,
  minEdge: 0.01,
  maxPicksPerGame: 3,
  allowCorrelation: true,
  excludeUnconfirmedLineups: false,
  riskMode: "balanced",
};

const settingsSchema = z.object({
  minLegs: z.number().int().min(2).max(10),
  maxLegs: z.number().int().min(2).max(12),
  minProbability: z.number().min(0).max(0.95),
  minEdge: z.number().min(-0.1).max(0.5),
  maxPicksPerGame: z.number().int().min(1).max(6),
  allowCorrelation: z.boolean(),
  excludeUnconfirmedLineups: z.boolean(),
  riskMode: z.enum(["conservative", "balanced", "aggressive"]),
});

const generateSchema = settingsSchema.partial().optional();

// ---- In-memory state (swap for PostgreSQL later) -------------------------

let settings: AppSettings = { ...DEFAULT_SETTINGS };
let cachedDay: MockDay | null = null;
let cachedParlays: { date: string; parlays: Parlay[] } | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDay(): MockDay {
  const date = todayKey();
  if (!cachedDay || cachedDay.date !== date) {
    cachedDay = buildMockDay(date);
    cachedParlays = null;
  }
  return cachedDay;
}

// ---- Pick pool ------------------------------------------------------------

function buildPickPool(day: MockDay, opts: AppSettings): PickLeg[] {
  const pool: PickLeg[] = [];

  for (const game of day.games) {
    if (opts.excludeUnconfirmedLineups && !game.lineupsConfirmed) continue;

    pool.push(scoreMoneylinePick(game));
    pool.push(scoreGameTotalPick(game));
    pool.push(scoreFirstFiveTotalPick(game));
    pool.push(scorePitcherStrikeoutPick(game.homePitcher, game, { teamKRate: game.away.teamKRate, abbr: game.away.abbr }));
    pool.push(scorePitcherStrikeoutPick(game.awayPitcher, game, { teamKRate: game.home.teamKRate, abbr: game.home.abbr }));

    const sides: Array<{ lineup: Batter[]; pitcher: Game["homePitcher"]; isHome: boolean }> = [
      { lineup: game.homeLineup, pitcher: game.awayPitcher, isHome: true },
      { lineup: game.awayLineup, pitcher: game.homePitcher, isHome: false },
    ];

    for (const side of sides) {
      // Hit props: top 6 lineup spots only - bottom of the order rarely prices well.
      for (const batter of side.lineup.slice(0, 6)) {
        pool.push(scoreHitPick(batter, { game, opposingPitcher: side.pitcher, isHome: side.isHome }));
      }
      // 2+ TB props: best power bats.
      const powerBats = [...side.lineup].sort((a, b) => b.xslg - a.xslg).slice(0, 3);
      for (const batter of powerBats) {
        pool.push(scoreTwoTotalBasesPick(batter, { game, opposingPitcher: side.pitcher, isHome: side.isHome }));
      }
    }
  }

  return pool;
}

// ---- Two-hit candidates ----------------------------------------------------

function buildTwoHitCandidates(day: MockDay): TwoHitCandidate[] {
  const candidates: TwoHitCandidate[] = [];

  for (const game of day.games) {
    const sides = [
      { lineup: game.homeLineup, pitcher: game.awayPitcher, team: game.home, opponent: game.away },
      { lineup: game.awayLineup, pitcher: game.homePitcher, team: game.away, opponent: game.home },
    ];

    for (const side of sides) {
      for (const batter of side.lineup.slice(0, 5)) {
        // Per-AB hit probability blended with the opposing pitcher, then a
        // binomial estimate of 2+ hits over expected at-bats.
        let perAb = batter.avg * 0.35 + batter.xba * 0.3 + batter.last10.avg * 0.2 + side.pitcher.avgAllowed * 0.15;
        perAb *= 1 + (game.stadium.hitFactor - 1) * 0.6;
        perAb *= 1 + (batter.contactRate - 0.76) * 0.4;
        perAb = clampProbability(perAb, 0.14, 0.4);

        const n = Math.round(4.4 - (batter.lineupSpot - 1) * 0.1);
        const p0 = Math.pow(1 - perAb, n);
        const p1 = n * perAb * Math.pow(1 - perAb, n - 1);
        const pTwoPlus = clampProbability(1 - p0 - p1, 0.05, 0.55);

        const marketOdds = probabilityToAmericanOdds(clampProbability(pTwoPlus + 0.045, 0.05, 0.95));
        const implied = americanOddsToImpliedProbability(marketOdds);
        const edge = pTwoPlus - implied;
        const score = Math.max(0, Math.min(100, Math.round(50 + edge * 380 + (pTwoPlus - 0.28) * 110 + (game.lineupsConfirmed ? 3 : -3))));

        candidates.push({
          playerId: batter.id,
          player: batter.name,
          team: side.team.abbr,
          opponent: side.opponent.abbr,
          opposingPitcher: side.pitcher.name,
          estimatedProbability: round(pTwoPlus),
          edge: round(edge),
          confidenceScore: score,
          confidenceLabel: getConfidenceLabel(score),
          last5: `${batter.last5.hits}-for-${batter.last5.atBats} (${batter.last5.avg.toFixed(3)})`,
          last10: `${batter.last10.hits}-for-${batter.last10.atBats} (${batter.last10.avg.toFixed(3)})`,
          last15: `${batter.last15.hits}-for-${batter.last15.atBats} (${batter.last15.avg.toFixed(3)})`,
          stadiumHistory: `${batter.stadiumAvg.toFixed(3)} AVG in ${batter.stadiumGames} games`,
          avg: batter.avg,
          obp: batter.obp,
          contactRate: batter.contactRate,
          kRate: batter.kRate,
          reason:
            `High-contact profile (${(batter.contactRate * 100).toFixed(0)}% contact, ${(batter.kRate * 100).toFixed(0)}% K) ` +
            `batting #${batter.lineupSpot} vs ${side.pitcher.name} (${side.pitcher.avgAllowed.toFixed(3)} AVG allowed).`,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.estimatedProbability - a.estimatedProbability).slice(0, 12);
}

// ---- Router ----------------------------------------------------------------

export const router: Router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", mockMode: process.env.MOCK_MODE !== "false", time: new Date().toISOString() });
});

router.get("/mlb/games/today", (_req, res) => {
  const day = getDay();
  res.json({ date: day.date, games: day.games });
});

router.get("/mlb/odds/today", (_req, res) => {
  const day = getDay();
  res.json({
    date: day.date,
    odds: day.games.map((g) => ({
      gameId: g.id,
      game: `${g.away.abbr} @ ${g.home.abbr}`,
      ...g.odds,
    })),
  });
});

router.post("/mlb/parlays/generate", (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid settings", details: parsed.error.flatten() });
  }
  const effective: AppSettings = { ...settings, ...(parsed.data ?? {}) };
  const day = getDay();
  const pool = buildPickPool(day, effective);
  const parlays = generateParlays(pool, effective);
  cachedParlays = { date: day.date, parlays };
  res.json({ date: day.date, parlays, settings: effective });
});

router.get("/mlb/parlays/today", (_req, res) => {
  const day = getDay();
  if (!cachedParlays || cachedParlays.date !== day.date) {
    const pool = buildPickPool(day, settings);
    cachedParlays = { date: day.date, parlays: generateParlays(pool, settings) };
  }
  res.json({ date: day.date, parlays: cachedParlays.parlays });
});

router.get("/mlb/picks/top", (_req, res) => {
  const day = getDay();
  const pool = buildPickPool(day, settings)
    .filter((p) => p.edge > 0)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
  res.json({ date: day.date, picks: pool.slice(0, 40) });
});

router.get("/mlb/picks/top-2-hit-candidates", (_req, res) => {
  const day = getDay();
  res.json({ date: day.date, candidates: buildTwoHitCandidates(day) });
});

router.get("/mlb/player/:id/matchup", (req, res) => {
  const day = getDay();
  for (const game of day.games) {
    const sides = [
      { lineup: game.homeLineup, pitcher: game.awayPitcher, team: game.home, opponent: game.away },
      { lineup: game.awayLineup, pitcher: game.homePitcher, team: game.away, opponent: game.home },
    ];
    for (const side of sides) {
      const batter = side.lineup.find((b) => b.id === req.params.id);
      if (batter) {
        return res.json({
          batter,
          game: { id: game.id, label: `${game.away.abbr} @ ${game.home.abbr}`, startTimeET: game.startTimeET, lineupsConfirmed: game.lineupsConfirmed },
          opposingPitcher: side.pitcher,
          stadium: game.stadium,
          weather: game.weather,
        });
      }
    }
  }
  res.status(404).json({ error: "Player not found in today's lineups" });
});

router.get("/mlb/stadium/:id/splits", (req, res) => {
  const day = getDay();
  const stadium = day.stadiums.find((s) => s.id === req.params.id);
  if (!stadium) return res.status(404).json({ error: "Stadium not found" });

  const game = day.games.find((g) => g.stadium.id === stadium.id);
  res.json({
    stadium,
    todayGame: game ? `${game.away.abbr} @ ${game.home.abbr} ${game.startTimeET}` : null,
    weather: game?.weather ?? null,
    splits: {
      hitFactor: stadium.hitFactor,
      runFactor: stadium.runFactor,
      hrFactor: stadium.hrFactor,
      notes:
        stadium.hitFactor >= 1.03
          ? "Hitter-friendly park: boosts batting average and offense."
          : stadium.runFactor <= 0.94
            ? "Pitcher-friendly park: suppresses run scoring."
            : "Roughly neutral run environment.",
    },
  });
});

router.get("/mlb/settings", (_req, res) => {
  res.json(settings);
});

router.post("/mlb/settings", (req, res) => {
  const parsed = settingsSchema.partial().safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid settings", details: parsed.error.flatten() });
  }
  settings = { ...settings, ...parsed.data };
  if (settings.minLegs > settings.maxLegs) {
    settings.maxLegs = settings.minLegs;
  }
  cachedParlays = null;
  res.json(settings);
});

router.get("/mlb/results/tracker", (_req, res) => {
  const day = getDay();
  res.json({ date: day.date, bets: day.trackedBets, performance: day.modelPerformance });
});

router.get("/mlb/model/performance", (_req, res) => {
  const day = getDay();
  res.json(day.modelPerformance);
});
