import type { Pitcher } from "../types.js";
import { getPeopleWithStats, type HydratedPerson, type PersonStatGroup } from "./mlbOfficialApi.js";

function num(v: unknown): number {
  const n = typeof v === "string" ? Number.parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** "5.2" innings pitched -> 5.667 */
function inningsToDecimal(ip: unknown): number {
  const s = String(ip ?? "0");
  const [whole, outs] = s.split(".");
  return num(whole) + num(outs) / 3;
}

function findGroup(person: HydratedPerson, type: string): PersonStatGroup | undefined {
  return person.stats?.find((s) => s.type.displayName === type);
}

export interface PitcherProfile {
  personId: number;
  name: string;
  throws: "L" | "R";
  season: {
    era: number;
    whip: number;
    strikeOuts: number;
    battersFaced: number;
    inningsPitched: number;
    avgAllowed: number;
    gamesStarted: number;
  };
  last3KCounts: number[];
  last3Innings: number[];
  last3PitchCounts: number[];
}

export function parsePitcherProfile(person: HydratedPerson): PitcherProfile {
  const season = findGroup(person, "season")?.splits?.[0]?.stat ?? {};
  const logs = (findGroup(person, "gameLog")?.splits ?? [])
    .slice()
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1))
    .map((s) => s.stat);
  const last3 = logs.slice(0, 3);

  return {
    personId: person.id,
    name: person.fullName,
    throws: (person.pitchHand?.code as "L" | "R") ?? "R",
    season: {
      era: num(season.era),
      whip: num(season.whip),
      strikeOuts: num(season.strikeOuts),
      battersFaced: num(season.battersFaced),
      inningsPitched: inningsToDecimal(season.inningsPitched),
      avgAllowed: num(season.avg),
      gamesStarted: num(season.gamesStarted),
    },
    last3KCounts: last3.map((s) => num(s.strikeOuts)),
    last3Innings: last3.map((s) => inningsToDecimal(s.inningsPitched)),
    last3PitchCounts: last3.map((s) => num(s.numberOfPitches ?? s.pitchesThrown)),
  };
}

export async function getPitcherProfiles(personIds: number[], season: number): Promise<Map<number, PitcherProfile>> {
  const people = await getPeopleWithStats(personIds, "pitching", season);
  const map = new Map<number, PitcherProfile>();
  for (const person of people) {
    const profile = parsePitcherProfile(person);
    map.set(profile.personId, profile);
  }
  return map;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Build a scoring-engine Pitcher from an official pitching profile.
 * The strikeout line is synthesized around the projection because odds are
 * still mock - it is replaced when a sportsbook feed is connected.
 */
export function pitcherFromProfile(profile: PitcherProfile, teamAbbr: string): Pitcher {
  const s = profile.season;
  const kRate = s.battersFaced > 0 ? s.strikeOuts / s.battersFaced : 0.22;
  const kPer9 = s.inningsPitched > 0 ? (s.strikeOuts / s.inningsPitched) * 9 : 8;
  const projectedInnings =
    profile.last3Innings.length > 0
      ? Math.max(4, Math.min(7, profile.last3Innings.reduce((a, b) => a + b, 0) / profile.last3Innings.length))
      : 5.3;
  const knownPitchCounts = profile.last3PitchCounts.filter((p) => p > 0);
  const avgPitchCount =
    knownPitchCounts.length > 0
      ? Math.round(knownPitchCounts.reduce((a, b) => a + b, 0) / knownPitchCounts.length)
      : 92;
  const expectedKs = projectedInnings * 4.25 * kRate;

  return {
    id: String(profile.personId),
    personId: profile.personId,
    name: profile.name,
    teamAbbr,
    throws: profile.throws,
    era: s.era || 4.2,
    whip: s.whip || 1.28,
    kRate: r3(kRate),
    kPer9: r3(kPer9),
    avgAllowed: s.avgAllowed || 0.248,
    slgAllowed: r3(Math.max(0.3, Math.min(0.5, (s.avgAllowed || 0.248) + 0.155))),
    whiffRate: r3(Math.max(0.18, Math.min(0.36, kRate + 0.04))),
    avgPitchCount,
    projectedInnings: r3(projectedInnings),
    last3KCounts: profile.last3KCounts.length > 0 ? profile.last3KCounts : [Math.round(expectedKs)],
    kLine: Math.max(2.5, Math.round(expectedKs) - 0.5),
  };
}
