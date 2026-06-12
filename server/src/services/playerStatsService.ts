import type { Batter, BatterWindow } from "../types.js";
import { getPeopleWithStats, type HydratedPerson, type PersonStatGroup } from "./mlbOfficialApi.js";

function num(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

function findGroup(person: HydratedPerson, type: string): PersonStatGroup | undefined {
  return person.stats?.find((s) => s.type.displayName === type);
}

function windowFromLogs(logs: Array<Record<string, unknown>>, games: number): BatterWindow {
  const slice = logs.slice(0, games);
  const hits = slice.reduce((a, s) => a + num(s.hits), 0);
  const atBats = slice.reduce((a, s) => a + num(s.atBats), 0);
  const totalBases = slice.reduce((a, s) => a + num(s.totalBases), 0);
  return {
    games: slice.length,
    hits,
    atBats,
    avg: atBats > 0 ? Math.round((hits / atBats) * 1000) / 1000 : 0,
    totalBases,
  };
}

export interface HitterProfile {
  personId: number;
  name: string;
  bats: "L" | "R" | "S";
  position: string;
  season: {
    avg: number;
    obp: number;
    slg: number;
    plateAppearances: number;
    gamesPlayed: number;
    strikeOuts: number;
  };
  last5: BatterWindow;
  last10: BatterWindow;
  last15: BatterWindow;
  /** Game dates (newest first) from the player's game log */
  gameDates: string[];
}

export function parseHitterProfile(person: HydratedPerson): HitterProfile | null {
  const seasonGroup = findGroup(person, "season");
  const logGroup = findGroup(person, "gameLog");
  const season = seasonGroup?.splits?.[0]?.stat ?? {};
  const logs = (logGroup?.splits ?? [])
    .slice()
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1))
    .map((s) => ({ ...s.stat, __date: s.date }) as Record<string, unknown>);

  return {
    personId: person.id,
    name: person.fullName,
    bats: (person.batSide?.code as "L" | "R" | "S") ?? "R",
    position: person.primaryPosition?.abbreviation ?? "—",
    season: {
      avg: num(season.avg),
      obp: num(season.obp),
      slg: num(season.slg),
      plateAppearances: num(season.plateAppearances),
      gamesPlayed: num(season.gamesPlayed),
      strikeOuts: num(season.strikeOuts),
    },
    last5: windowFromLogs(logs, 5),
    last10: windowFromLogs(logs, 10),
    last15: windowFromLogs(logs, 15),
    gameDates: logs.map((l) => String(l.__date ?? "")).filter(Boolean),
  };
}

/** Fetch official hitting profiles for a set of players in batched calls. */
export async function getHitterProfiles(personIds: number[], season: number): Promise<Map<number, HitterProfile>> {
  const people = await getPeopleWithStats(personIds, "hitting", season);
  const map = new Map<number, HitterProfile>();
  for (const person of people) {
    const profile = parseHitterProfile(person);
    if (profile) map.set(profile.personId, profile);
  }
  return map;
}

/**
 * Build a scoring-engine Batter from an official hitting profile.
 * Statcast-only fields (xBA, barrel%, etc.) are estimated from the official
 * slash line since the public Stats API does not expose them.
 */
export function batterFromProfile(
  profile: HitterProfile,
  opts: { teamAbbr: string; lineupSpot: number }
): Batter {
  const { season } = profile;
  const avg = season.avg || 0.245;
  const slg = season.slg || avg + 0.15;
  const iso = Math.max(0.05, slg - avg);
  const kRate = season.plateAppearances > 0 ? season.strikeOuts / season.plateAppearances : 0.22;
  const contactRate = Math.max(0.6, Math.min(0.92, 1 - kRate - 0.05));

  return {
    id: String(profile.personId),
    personId: profile.personId,
    name: profile.name,
    teamAbbr: opts.teamAbbr,
    bats: profile.bats,
    position: profile.position,
    lineupSpot: opts.lineupSpot,
    avg,
    obp: season.obp || avg + 0.07,
    slg,
    iso,
    xba: avg,
    xslg: slg,
    contactRate,
    kRate,
    hardHitPct: Math.max(0.25, Math.min(0.55, 0.3 + iso * 0.8)),
    barrelPct: Math.max(0.03, Math.min(0.18, iso * 0.55)),
    last5: profile.last5,
    last10: profile.last10,
    last15: profile.last15,
    vsPitcher: { atBats: 0, hits: 0, avg: 0, homeRuns: 0 },
    stadiumAvg: avg,
    stadiumGames: 0,
  };
}
