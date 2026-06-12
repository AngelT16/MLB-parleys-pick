import { Router } from "express";
import { z } from "zod";
import { buildMockDay } from "./mockData.js";
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
import { buildParlayPerformance } from "./scoring/parlayResults.js";
import { buildOfficialDay, type OfficialDay } from "./services/officialDataService.js";
import { clearOfficialApiCache } from "./services/mlbOfficialApi.js";
import { getAllParlays, getParlayHistory, getParlaysForDate, saveDailyParlays } from "./services/parlayStore.js";
import { settleDailyParlays } from "./services/settlementService.js";
import type {
  AppSettings,
  Batter,
  DataSource,
  DataStatus,
  Game,
  Parlay,
  PickLeg,
  PlayerEligibility,
  Stadium,
  TwoHitCandidate,
} from "./types.js";

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
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ---- Data layer: official MLB data with mock fallback -----------------------

export function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

interface DayData {
  date: string;
  source: DataSource;
  games: Game[];
  stadiums: Stadium[];
  eligibilityByGame: Record<string, PlayerEligibility[]>;
  projectedRegularsUsed: number;
  lastSync: string | null;
  officialError: string | null;
}

let settings: AppSettings = { ...DEFAULT_SETTINGS };
let cachedDay: DayData | null = null;
let inflightBuild: Promise<DayData> | null = null;
let cachedParlays: { date: string; parlays: Parlay[] } | null = null;

/** MLB "today" follows the US/Eastern calendar, not UTC. */
function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function mockDayData(date: string, officialError: string | null): DayData {
  const mock = buildMockDay(date);
  return {
    date,
    source: "mock",
    games: mock.games,
    stadiums: mock.stadiums,
    eligibilityByGame: {},
    projectedRegularsUsed: 0,
    lastSync: null,
    officialError,
  };
}

function officialToDayData(day: OfficialDay): DayData {
  return {
    date: day.date,
    source: "mlb-official",
    games: day.games,
    stadiums: day.stadiums,
    eligibilityByGame: day.eligibilityByGame,
    projectedRegularsUsed: day.projectedRegularsUsed,
    lastSync: day.lastSync,
    officialError: null,
  };
}

async function getDay(forceRefresh = false): Promise<DayData> {
  const date = todayKey();
  if (!forceRefresh && cachedDay && cachedDay.date === date) return cachedDay;

  if (isMockMode()) {
    cachedDay = mockDayData(date, null);
    cachedParlays = null;
    return cachedDay;
  }

  if (!inflightBuild) {
    inflightBuild = (async () => {
      try {
        return officialToDayData(await buildOfficialDay(date));
      } catch (err) {
        console.error("[data] Official MLB data unavailable, falling back to mock:", err);
        return mockDayData(date, err instanceof Error ? err.message : String(err));
      }
    })();
  }

  try {
    const day = await inflightBuild;
    if (!cachedDay || cachedDay.date !== day.date || cachedDay.source !== day.source || forceRefresh) {
      cachedParlays = null;
    }
    cachedDay = day;
    return day;
  } finally {
    inflightBuild = null;
  }
}

function dataStatusFor(day: DayData): DataStatus {
  return {
    source: day.source,
    oddsSource: "mock",
    mockMode: isMockMode(),
    officialApiOk: day.source === "mlb-official",
    date: day.date,
    totalGames: day.games.length,
    lineupsConfirmed: day.games.filter((g) => g.lineupsConfirmed).length,
    projectedRegularsUsed: day.projectedRegularsUsed,
    lastSync: day.lastSync,
    officialError: day.officialError,
  };
}

// ---- Pick pool ------------------------------------------------------------

function buildPickPool(day: DayData, opts: AppSettings): PickLeg[] {
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
      // Official lineups only contain CONFIRMED / PROJECTED_REGULAR players;
      // this guard protects against any EXCLUDED batter sneaking in.
      const usable = side.lineup.filter((b) => !b.lineupStatus || b.lineupStatus === "CONFIRMED" || b.lineupStatus === "PROJECTED_REGULAR");
      // Hit props: top 6 lineup spots only - bottom of the order rarely prices well.
      for (const batter of usable.slice(0, 6)) {
        pool.push(scoreHitPick(batter, { game, opposingPitcher: side.pitcher, isHome: side.isHome }));
      }
      // 2+ TB props: best power bats.
      const powerBats = [...usable].sort((a, b) => b.xslg - a.xslg).slice(0, 3);
      for (const batter of powerBats) {
        pool.push(scoreTwoTotalBasesPick(batter, { game, opposingPitcher: side.pitcher, isHome: side.isHome }));
      }
    }
  }

  return pool;
}

// ---- Two-hit candidates ----------------------------------------------------

function buildTwoHitCandidates(day: DayData): TwoHitCandidate[] {
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
          stadiumHistory: batter.stadiumGames > 0 ? `${batter.stadiumAvg.toFixed(3)} AVG in ${batter.stadiumGames} games` : "No park history",
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

// ---- Parlay generation (always persisted as the official daily set) ---------

async function generateAndStoreParlays(effective: AppSettings): Promise<{ date: string; parlays: Parlay[] }> {
  const day = await getDay();
  const pool = buildPickPool(day, effective);
  const parlays = generateParlays(pool, effective);
  cachedParlays = { date: day.date, parlays };
  saveDailyParlays(day.date, parlays);
  return { date: day.date, parlays };
}

// ---- Router ----------------------------------------------------------------

export const router: Router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", mockMode: isMockMode(), time: new Date().toISOString() });
});

// ---- Official data endpoints -------------------------------------------------

router.get("/mlb/data/status", async (_req, res) => {
  const day = await getDay();
  res.json(dataStatusFor(day));
});

router.post("/mlb/data/sync-official", async (_req, res) => {
  clearOfficialApiCache();
  const day = await getDay(true);
  res.json({ synced: day.source === "mlb-official", status: dataStatusFor(day) });
});

router.get("/mlb/games/today", async (_req, res) => {
  const day = await getDay();
  res.json({ date: day.date, source: day.source, games: day.games });
});

router.get("/mlb/lineups/today", async (_req, res) => {
  const day = await getDay();
  res.json({
    date: day.date,
    source: day.source,
    games: day.games.map((g) => ({
      gamePk: g.gamePk ?? null,
      game: `${g.away.abbr} @ ${g.home.abbr}`,
      startTimeET: g.startTimeET,
      lineupsConfirmed: g.lineupsConfirmed,
      home: g.homeLineup.map((b) => ({
        playerId: b.personId ?? b.id,
        name: b.name,
        position: b.position,
        lineupSpot: b.lineupSpot,
        lineupStatus: b.lineupStatus ?? (g.lineupsConfirmed ? "CONFIRMED" : "PENDING"),
        eligibilityReason: b.eligibilityReason ?? null,
      })),
      away: g.awayLineup.map((b) => ({
        playerId: b.personId ?? b.id,
        name: b.name,
        position: b.position,
        lineupSpot: b.lineupSpot,
        lineupStatus: b.lineupStatus ?? (g.lineupsConfirmed ? "CONFIRMED" : "PENDING"),
        eligibilityReason: b.eligibilityReason ?? null,
      })),
    })),
  });
});

router.get("/mlb/players/eligible", async (req, res) => {
  const day = await getDay();
  const gamePk = typeof req.query.gamePk === "string" ? req.query.gamePk : null;
  if (gamePk) {
    const players = day.eligibilityByGame[gamePk];
    if (!players) return res.status(404).json({ error: `No eligibility data for game ${gamePk}` });
    return res.json({ date: day.date, gamePk, players });
  }
  res.json({ date: day.date, byGame: day.eligibilityByGame });
});

router.get("/mlb/odds/today", async (_req, res) => {
  const day = await getDay();
  res.json({
    date: day.date,
    oddsSource: "mock",
    odds: day.games.map((g) => ({
      gameId: g.id,
      game: `${g.away.abbr} @ ${g.home.abbr}`,
      ...g.odds,
    })),
  });
});

// ---- Parlays -------------------------------------------------------------------

router.post("/mlb/parlays/generate", async (req, res) => {
  const parsed = generateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid settings", details: parsed.error.flatten() });
  }
  const effective: AppSettings = { ...settings, ...(parsed.data ?? {}) };
  const result = await generateAndStoreParlays(effective);
  res.json({ ...result, settings: effective, official: getParlaysForDate(result.date) });
});

router.get("/mlb/parlays/today", async (_req, res) => {
  const day = await getDay();
  const stored = getParlaysForDate(day.date);
  if (stored.length > 0) {
    return res.json({ date: day.date, parlays: stored });
  }
  if (!cachedParlays || cachedParlays.date !== day.date) {
    await generateAndStoreParlays(settings);
  }
  res.json({ date: day.date, parlays: getParlaysForDate(day.date) });
});

// ---- Picks ----------------------------------------------------------------------

router.get("/mlb/picks/top", async (_req, res) => {
  const day = await getDay();
  const pool = buildPickPool(day, settings)
    .filter((p) => p.edge > 0)
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
  res.json({ date: day.date, picks: pool.slice(0, 40) });
});

router.get("/mlb/picks/top-2-hit-candidates", async (_req, res) => {
  const day = await getDay();
  res.json({ date: day.date, candidates: buildTwoHitCandidates(day) });
});

router.get("/mlb/player/:id/matchup", async (req, res) => {
  const day = await getDay();
  for (const game of day.games) {
    const sides = [
      { lineup: game.homeLineup, pitcher: game.awayPitcher },
      { lineup: game.awayLineup, pitcher: game.homePitcher },
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

router.get("/mlb/stadium/:id/splits", async (req, res) => {
  const day = await getDay();
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

// ---- Settings --------------------------------------------------------------------

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

// ---- Results & full-parlay performance --------------------------------------------

router.post("/mlb/results/settle-today", async (_req, res) => {
  const summary = await settleDailyParlays(todayKey());
  res.json(summary);
});

router.post("/mlb/results/settle-date", async (req, res) => {
  const parsed = dateSchema.safeParse(req.query.date);
  if (!parsed.success) {
    return res.status(400).json({ error: "Pass ?date=YYYY-MM-DD" });
  }
  const summary = await settleDailyParlays(parsed.data);
  res.json(summary);
});

router.get("/mlb/results/today", (_req, res) => {
  const date = todayKey();
  res.json({ date, parlays: getParlaysForDate(date) });
});

router.get("/mlb/results/history", (_req, res) => {
  res.json({ history: getParlayHistory() });
});

router.get("/mlb/model-performance", (_req, res) => {
  res.json(buildParlayPerformance(getAllParlays()));
});
