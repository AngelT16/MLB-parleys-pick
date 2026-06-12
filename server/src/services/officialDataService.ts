import type { Batter, Game, PlayerEligibility, Stadium, Team, Weather } from "../types.js";
import {
  getSchedule,
  getTeamRecentGameDates,
  getTeamRecentResults,
  getTeamSeasonStats,
  type ScheduleGame,
} from "./mlbOfficialApi.js";
import { getGameLineups, getTeamRosterInfo, type TeamLineup } from "./lineupService.js";
import { batterFromProfile, getHitterProfiles, type HitterProfile } from "./playerStatsService.js";
import { getPitcherProfiles, pitcherFromProfile } from "./pitcherStatsService.js";
import { countGamesPlayed, evaluatePlayerEligibility } from "./pickEligibilityService.js";

// ---- Static park data (the Stats API does not expose park factors) ----------

interface ParkInfo {
  abbr: string;
  stadium: string;
  hitFactor: number;
  runFactor: number;
  hrFactor: number;
  roof: Stadium["roof"];
}

const PARKS: Record<number, ParkInfo> = {
  108: { abbr: "LAA", stadium: "Angel Stadium", hitFactor: 0.99, runFactor: 0.98, hrFactor: 1.02, roof: "open" },
  109: { abbr: "AZ", stadium: "Chase Field", hitFactor: 1.02, runFactor: 1.03, hrFactor: 1.02, roof: "retractable" },
  110: { abbr: "BAL", stadium: "Oriole Park at Camden Yards", hitFactor: 0.99, runFactor: 1.0, hrFactor: 1.04, roof: "open" },
  111: { abbr: "BOS", stadium: "Fenway Park", hitFactor: 1.08, runFactor: 1.06, hrFactor: 0.97, roof: "open" },
  112: { abbr: "CHC", stadium: "Wrigley Field", hitFactor: 1.02, runFactor: 1.04, hrFactor: 1.05, roof: "open" },
  113: { abbr: "CIN", stadium: "Great American Ball Park", hitFactor: 1.02, runFactor: 1.05, hrFactor: 1.18, roof: "open" },
  114: { abbr: "CLE", stadium: "Progressive Field", hitFactor: 1.0, runFactor: 0.98, hrFactor: 0.97, roof: "open" },
  115: { abbr: "COL", stadium: "Coors Field", hitFactor: 1.12, runFactor: 1.15, hrFactor: 1.12, roof: "open" },
  116: { abbr: "DET", stadium: "Comerica Park", hitFactor: 0.99, runFactor: 0.96, hrFactor: 0.92, roof: "open" },
  117: { abbr: "HOU", stadium: "Daikin Park", hitFactor: 1.0, runFactor: 1.01, hrFactor: 1.08, roof: "retractable" },
  118: { abbr: "KC", stadium: "Kauffman Stadium", hitFactor: 1.03, runFactor: 1.01, hrFactor: 0.9, roof: "open" },
  119: { abbr: "LAD", stadium: "Dodger Stadium", hitFactor: 0.97, runFactor: 0.98, hrFactor: 1.1, roof: "open" },
  120: { abbr: "WSH", stadium: "Nationals Park", hitFactor: 1.0, runFactor: 1.0, hrFactor: 1.02, roof: "open" },
  121: { abbr: "NYM", stadium: "Citi Field", hitFactor: 0.96, runFactor: 0.94, hrFactor: 0.95, roof: "open" },
  133: { abbr: "ATH", stadium: "Sutter Health Park", hitFactor: 1.01, runFactor: 1.0, hrFactor: 0.98, roof: "open" },
  134: { abbr: "PIT", stadium: "PNC Park", hitFactor: 1.0, runFactor: 0.96, hrFactor: 0.9, roof: "open" },
  135: { abbr: "SD", stadium: "Petco Park", hitFactor: 0.95, runFactor: 0.93, hrFactor: 0.94, roof: "open" },
  136: { abbr: "SEA", stadium: "T-Mobile Park", hitFactor: 0.94, runFactor: 0.92, hrFactor: 0.99, roof: "retractable" },
  137: { abbr: "SF", stadium: "Oracle Park", hitFactor: 0.97, runFactor: 0.94, hrFactor: 0.88, roof: "open" },
  138: { abbr: "STL", stadium: "Busch Stadium", hitFactor: 0.98, runFactor: 0.95, hrFactor: 0.9, roof: "open" },
  139: { abbr: "TB", stadium: "George M. Steinbrenner Field", hitFactor: 1.0, runFactor: 1.0, hrFactor: 1.05, roof: "open" },
  140: { abbr: "TEX", stadium: "Globe Life Field", hitFactor: 0.98, runFactor: 0.99, hrFactor: 1.02, roof: "retractable" },
  141: { abbr: "TOR", stadium: "Rogers Centre", hitFactor: 1.0, runFactor: 1.01, hrFactor: 1.05, roof: "retractable" },
  142: { abbr: "MIN", stadium: "Target Field", hitFactor: 1.0, runFactor: 0.99, hrFactor: 1.0, roof: "open" },
  143: { abbr: "PHI", stadium: "Citizens Bank Park", hitFactor: 1.01, runFactor: 1.04, hrFactor: 1.15, roof: "open" },
  144: { abbr: "ATL", stadium: "Truist Park", hitFactor: 1.01, runFactor: 1.02, hrFactor: 1.06, roof: "open" },
  145: { abbr: "CWS", stadium: "Rate Field", hitFactor: 1.0, runFactor: 1.01, hrFactor: 1.1, roof: "open" },
  146: { abbr: "MIA", stadium: "loanDepot park", hitFactor: 0.97, runFactor: 0.92, hrFactor: 0.88, roof: "retractable" },
  147: { abbr: "NYY", stadium: "Yankee Stadium", hitFactor: 0.99, runFactor: 1.05, hrFactor: 1.18, roof: "open" },
  158: { abbr: "MIL", stadium: "American Family Field", hitFactor: 1.0, runFactor: 1.02, hrFactor: 1.08, roof: "retractable" },
};

function parkFor(teamId: number, fallbackAbbr: string): ParkInfo {
  return (
    PARKS[teamId] ?? {
      abbr: fallbackAbbr,
      stadium: "Unknown Park",
      hitFactor: 1.0,
      runFactor: 1.0,
      hrFactor: 1.0,
      roof: "open",
    }
  );
}

// ---- Helpers -----------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function hashNoise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function toMl(p: number): number {
  const clamped = Math.min(0.82, Math.max(0.18, p));
  return clamped >= 0.5
    ? -Math.round((clamped / (1 - clamped)) * 100)
    : Math.round(((1 - clamped) / clamped) * 100);
}

function startTimeET(gameDateIso: string): string {
  try {
    return new Date(gameDateIso).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

// ---- Per-team aggregates (cached per day by the API layer) -------------------

interface TeamContext {
  team: Team;
  rosterInfo: Awaited<ReturnType<typeof getTeamRosterInfo>>;
  recentGameDates: string[];
}

async function buildTeamContext(teamId: number, teamName: string, date: string, season: number): Promise<TeamContext> {
  const [hitting, pitching, recentResults, rosterInfo] = await Promise.all([
    getTeamSeasonStats(teamId, "hitting", season).catch(() => null),
    getTeamSeasonStats(teamId, "pitching", season).catch(() => null),
    getTeamRecentResults(teamId, date).catch(() => []),
    getTeamRosterInfo(teamId),
  ]);

  const park = parkFor(teamId, teamName.slice(0, 3).toUpperCase());
  const last7 = recentResults.slice(0, 7);
  const last14 = recentResults.slice(0, 14);
  const avgRuns = (rs: Array<{ runsScored: number }>, fallback: number) =>
    rs.length > 0 ? r3(rs.reduce((a, g) => a + g.runsScored, 0) / rs.length) : fallback;

  const pa = num(hitting?.plateAppearances);
  const so = num(hitting?.strikeOuts);
  const lastGameDate = recentResults[0]?.date;
  const restDays = lastGameDate
    ? Math.max(0, Math.round((Date.parse(date) - Date.parse(lastGameDate)) / 86_400_000) - 1)
    : 0;

  return {
    team: {
      id: String(teamId),
      mlbId: teamId,
      abbr: park.abbr,
      name: teamName,
      city: teamName.split(" ").slice(0, -1).join(" "),
      offenseLast7: avgRuns(last7, 4.4),
      offenseLast14: avgRuns(last14, 4.4),
      // Team season ERA as the bullpen proxy - statsapi has no bullpen split.
      bullpenEra: num(pitching?.era) || 4.0,
      teamKRate: pa > 0 ? r3(so / pa) : 0.22,
      restDays,
    },
    rosterInfo,
    recentGameDates: await getTeamRecentGameDates(teamId, date).catch(() => []),
  };
}

// ---- Lineup -> eligible batters ----------------------------------------------

interface SideBuild {
  batters: Batter[];
  eligibility: PlayerEligibility[];
  lineupConfirmed: boolean;
  projectedUsed: number;
}

async function buildSide(
  lineup: TeamLineup,
  ctx: TeamContext,
  season: number
): Promise<SideBuild> {
  const POSITION_PLAYER = (pos: string) => pos !== "P" && pos !== "TWP";

  // Candidates: posted lineup when confirmed, otherwise every active position player.
  const candidates = lineup.confirmed
    ? lineup.slots.map((s) => ({ personId: s.personId, name: s.name, position: s.position, spot: s.battingOrderSpot as number | null }))
    : [...ctx.rosterInfo.byId.values()]
        .filter((e) => POSITION_PLAYER(e.position.abbreviation))
        .map((e) => ({ personId: e.person.id, name: e.person.fullName, position: e.position.abbreviation, spot: null as number | null }));

  const profiles = await getHitterProfiles(candidates.map((c) => c.personId), season).catch(
    () => new Map<number, HitterProfile>()
  );

  const evaluated = candidates.map((c) => {
    const profile = profiles.get(c.personId);
    const teamDates5 = ctx.recentGameDates.slice(0, 5);
    const teamDates10 = ctx.recentGameDates.slice(0, 10);
    const gp5 = profile ? countGamesPlayed(profile.gameDates, teamDates5) : 0;
    const gp10 = profile ? countGamesPlayed(profile.gameDates, teamDates10) : 0;
    const onRoster = ctx.rosterInfo.byId.has(c.personId);
    const eligibility = evaluatePlayerEligibility({
      playerId: c.personId,
      playerName: c.name,
      teamId: ctx.team.mlbId ?? 0,
      teamAbbr: ctx.team.abbr,
      position: c.position,
      // A player in the posted lineup is playing today regardless of roster fetch hiccups.
      activeRoster: onRoster || c.spot !== null,
      injured: onRoster && !ctx.rosterInfo.activeIds.has(c.personId),
      lineupConfirmed: lineup.confirmed,
      battingOrderSpot: c.spot,
      gamesPlayedLast5: gp5,
      gamesPlayedLast10: gp10,
      seasonPlateAppearances: profile?.season.plateAppearances ?? 0,
      statsUnavailable: !profile,
      last5Games: profile ? `${profile.last5.hits}-for-${profile.last5.atBats}` : "",
    });
    return { candidate: c, profile, eligibility };
  });

  // Pick the 9 batters the scoring engine will see.
  const usable = evaluated
    .filter((e) => e.eligibility.eligibleForPicks && e.profile)
    .sort((a, b) => {
      const spotA = a.candidate.spot ?? 99;
      const spotB = b.candidate.spot ?? 99;
      if (spotA !== spotB) return spotA - spotB;
      return (b.profile?.season.plateAppearances ?? 0) - (a.profile?.season.plateAppearances ?? 0);
    })
    .slice(0, 9);

  const batters = usable.map((e, i) => {
    const batter = batterFromProfile(e.profile as HitterProfile, {
      teamAbbr: ctx.team.abbr,
      lineupSpot: e.candidate.spot ?? i + 1,
    });
    batter.lineupStatus = e.eligibility.lineupStatus;
    batter.activeRoster = e.eligibility.activeRoster;
    batter.recentGamesPlayed = e.eligibility.recentGamesPlayed;
    batter.eligibilityReason = e.eligibility.reason;
    return batter;
  });

  return {
    batters,
    eligibility: evaluated.map((e) => e.eligibility),
    lineupConfirmed: lineup.confirmed,
    projectedUsed: usable.filter((e) => e.eligibility.lineupStatus === "PROJECTED_REGULAR").length,
  };
}

// ---- Day builder ---------------------------------------------------------------

export interface OfficialDay {
  date: string;
  source: "mlb-official";
  games: Game[];
  stadiums: Stadium[];
  eligibilityByGame: Record<string, PlayerEligibility[]>;
  projectedRegularsUsed: number;
  lastSync: string;
}

export async function buildOfficialDay(date: string): Promise<OfficialDay> {
  const season = Number.parseInt(date.slice(0, 4), 10);
  const schedule = (await getSchedule(date)).filter(
    (g) => g.status.abstractGameState !== "Cancelled" && g.gameType !== "E"
  );

  const teamContexts = new Map<number, Promise<TeamContext>>();
  const ctxFor = (id: number, name: string) => {
    if (!teamContexts.has(id)) teamContexts.set(id, buildTeamContext(id, name, date, season));
    return teamContexts.get(id) as Promise<TeamContext>;
  };

  // Probable pitcher profiles in one batch across the whole slate.
  const pitcherIds = schedule.flatMap((g) =>
    [g.teams.home.probablePitcher?.id, g.teams.away.probablePitcher?.id].filter((id): id is number => Boolean(id))
  );
  const pitcherProfiles = await getPitcherProfiles(pitcherIds, season).catch(() => new Map());

  interface BuiltGame {
    game: Game;
    eligibility: PlayerEligibility[];
    projectedUsed: number;
    stadium: Stadium;
  }

  const games = await Promise.all(
    schedule.map(async (sg): Promise<BuiltGame | null> => {
      try {
        return await buildGame(sg);
      } catch (err) {
        console.error(`[mlb-official] Skipping game ${sg.gamePk}:`, err);
        return null;
      }
    })
  );

  async function buildGame(sg: ScheduleGame): Promise<BuiltGame> {
    const homeCtx = await ctxFor(sg.teams.home.team.id, sg.teams.home.team.name);
    const awayCtx = await ctxFor(sg.teams.away.team.id, sg.teams.away.team.name);
    const lineups = await getGameLineups(sg.gamePk).catch(() => ({
      gamePk: sg.gamePk,
      home: { teamId: sg.teams.home.team.id, confirmed: false, slots: [] },
      away: { teamId: sg.teams.away.team.id, confirmed: false, slots: [] },
    }));

    const [homeSide, awaySide] = await Promise.all([
      buildSide(lineups.home, homeCtx, season),
      buildSide(lineups.away, awayCtx, season),
    ]);

    const park = parkFor(sg.teams.home.team.id, homeCtx.team.abbr);
    const stadium: Stadium = {
      id: String(sg.venue?.id ?? sg.teams.home.team.id),
      name: sg.venue?.name ?? park.stadium,
      teamAbbr: homeCtx.team.abbr,
      hitFactor: park.hitFactor,
      runFactor: park.runFactor,
      hrFactor: park.hrFactor,
      roof: park.roof,
    };

    const weather: Weather =
      park.roof !== "open"
        ? { tempF: 72, windMph: 0, windDirection: "calm", condition: "Dome", impact: "neutral" }
        : { tempF: 75, windMph: 6, windDirection: "calm", condition: "Clear", impact: "neutral" };

    const homePitcherProfile = sg.teams.home.probablePitcher
      ? pitcherProfiles.get(sg.teams.home.probablePitcher.id)
      : undefined;
    const awayPitcherProfile = sg.teams.away.probablePitcher
      ? pitcherProfiles.get(sg.teams.away.probablePitcher.id)
      : undefined;
    if (!homePitcherProfile || !awayPitcherProfile) {
      throw new Error("Probable pitchers not announced yet");
    }

    const homePitcher = pitcherFromProfile(homePitcherProfile, homeCtx.team.abbr);
    const awayPitcher = pitcherFromProfile(awayPitcherProfile, awayCtx.team.abbr);

    // Mock odds synthesized from real team/pitcher data, with deterministic
    // market noise so model edges exist until a sportsbook feed is wired in.
    const noise = (hashNoise(`ml:${sg.gamePk}`) - 0.5) * 0.08;
    const pHome = Math.min(
      0.72,
      Math.max(
        0.28,
        0.5 +
          (awayPitcher.era - homePitcher.era) * 0.04 +
          (homeCtx.team.offenseLast14 - awayCtx.team.offenseLast14) * 0.015 +
          0.035 +
          noise
      )
    );
    const vig = 0.022;
    const baseTotal =
      (homeCtx.team.offenseLast14 + awayCtx.team.offenseLast14) * 0.5 * park.runFactor +
      (homePitcher.era + awayPitcher.era) * 0.45;
    const total = Math.round(baseTotal + (hashNoise(`total:${sg.gamePk}`) - 0.5) * 1.2) + 0.5;

    const game: Game = {
      id: String(sg.gamePk),
      gamePk: sg.gamePk,
      dataSource: "mlb-official",
      date,
      startTimeET: startTimeET(sg.gameDate),
      home: homeCtx.team,
      away: awayCtx.team,
      stadium,
      weather,
      homePitcher,
      awayPitcher,
      homeLineup: homeSide.batters,
      awayLineup: awaySide.batters,
      lineupsConfirmed: homeSide.lineupConfirmed && awaySide.lineupConfirmed,
      odds: {
        homeML: toMl(pHome + vig),
        awayML: toMl(1 - pHome + vig),
        total,
        overOdds: -110,
        underOdds: -110,
        f5Total: Math.round(total * 0.55) - 0.5,
        f5OverOdds: -112,
        f5UnderOdds: -108,
      },
    };

    return {
      game,
      eligibility: [...homeSide.eligibility, ...awaySide.eligibility],
      projectedUsed: homeSide.projectedUsed + awaySide.projectedUsed,
      stadium,
    };
  }

  const built = games.filter((g): g is BuiltGame => g !== null);
  if (built.length === 0) {
    throw new Error(`No buildable MLB games for ${date} (slate empty or pitchers unannounced)`);
  }

  const stadiums: Stadium[] = [];
  const eligibilityByGame: Record<string, PlayerEligibility[]> = {};
  let projectedRegularsUsed = 0;
  for (const b of built) {
    if (!stadiums.some((s) => s.id === b.stadium.id)) stadiums.push(b.stadium);
    eligibilityByGame[String(b.game.gamePk)] = b.eligibility;
    projectedRegularsUsed += b.projectedUsed;
  }

  return {
    date,
    source: "mlb-official",
    games: built.map((b) => b.game),
    stadiums,
    eligibilityByGame,
    projectedRegularsUsed,
    lastSync: new Date().toISOString(),
  };
}
