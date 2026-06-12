/**
 * Thin client for the official MLB Stats API (statsapi.mlb.com).
 * No API key required. All responses are cached in memory with a short TTL
 * so a dashboard refresh never hammers the API.
 */

const BASE = "https://statsapi.mlb.com/api/v1";
const BASE_V11 = "https://statsapi.mlb.com/api/v1.1";

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const LIVE_TTL_MS = 60 * 1000; // live feeds / boxscores move fast

interface CacheEntry {
  expires: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();

export function clearOfficialApiCache(): void {
  cache.clear();
}

async function fetchJson<T>(url: string, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`MLB API ${res.status} on ${url}`);
    }
    const json = (await res.json()) as T;
    cache.set(url, { expires: Date.now() + ttlMs, value: json });
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Raw response shapes (only the fields we read) --------------------------

export interface ScheduleTeamSide {
  team: { id: number; name: string; abbreviation?: string };
  probablePitcher?: { id: number; fullName: string };
  score?: number;
  isWinner?: boolean;
}

export interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  officialDate?: string;
  status: { abstractGameState: string; detailedState: string; codedGameState?: string };
  teams: { home: ScheduleTeamSide; away: ScheduleTeamSide };
  venue?: { id: number; name: string };
  doubleHeader?: string;
  gameType?: string;
  linescore?: Linescore;
}

export interface ScheduleResponse {
  dates: Array<{ date: string; games: ScheduleGame[] }>;
}

export interface Linescore {
  currentInning?: number;
  innings: Array<{ num: number; home: { runs?: number }; away: { runs?: number } }>;
  teams: { home: { runs?: number }; away: { runs?: number } };
}

export interface BoxscorePlayer {
  person: { id: number; fullName: string };
  position?: { abbreviation: string };
  battingOrder?: string;
  stats?: {
    batting?: { hits?: number; doubles?: number; triples?: number; homeRuns?: number; atBats?: number; plateAppearances?: number };
    pitching?: { strikeOuts?: number; inningsPitched?: string };
  };
}

export interface BoxscoreTeam {
  team: { id: number; name: string };
  battingOrder?: number[];
  players: Record<string, BoxscorePlayer>;
}

export interface BoxscoreResponse {
  teams: { home: BoxscoreTeam; away: BoxscoreTeam };
}

export interface LiveFeedResponse {
  gameData: {
    status: { abstractGameState: string; detailedState: string };
  };
  liveData: {
    linescore?: Linescore;
    boxscore?: BoxscoreResponse;
  };
}

export interface RosterEntry {
  person: { id: number; fullName: string };
  position: { abbreviation: string };
  status: { code: string; description: string };
}

export interface RosterResponse {
  roster: RosterEntry[];
}

export interface PersonStatSplit {
  date?: string;
  stat: Record<string, unknown>;
}

export interface PersonStatGroup {
  type: { displayName: string };
  group?: { displayName: string };
  splits: PersonStatSplit[];
}

export interface HydratedPerson {
  id: number;
  fullName: string;
  primaryPosition?: { abbreviation: string };
  batSide?: { code: string };
  pitchHand?: { code: string };
  stats?: PersonStatGroup[];
}

export interface PeopleResponse {
  people: HydratedPerson[];
}

export interface TeamStatsResponse {
  stats: Array<{
    group?: { displayName: string };
    splits: Array<{ stat: Record<string, unknown> }>;
  }>;
}

// ---- Endpoints ---------------------------------------------------------------

export async function getSchedule(date: string): Promise<ScheduleGame[]> {
  const url = `${BASE}/schedule?sportId=1&date=${date}&hydrate=team,probablePitcher,venue,linescore`;
  const res = await fetchJson<ScheduleResponse>(url, LIVE_TTL_MS * 5);
  return res.dates.flatMap((d) => d.games);
}

export async function getBoxscore(gamePk: number): Promise<BoxscoreResponse> {
  return fetchJson<BoxscoreResponse>(`${BASE}/game/${gamePk}/boxscore`, LIVE_TTL_MS);
}

export async function getLiveFeed(gamePk: number): Promise<LiveFeedResponse> {
  return fetchJson<LiveFeedResponse>(`${BASE_V11}/game/${gamePk}/feed/live`, LIVE_TTL_MS);
}

export async function getActiveRoster(teamId: number): Promise<RosterEntry[]> {
  const res = await fetchJson<RosterResponse>(`${BASE}/teams/${teamId}/roster?rosterType=active`);
  return res.roster ?? [];
}

/**
 * Batch-hydrate people with season + game log stats in a single request.
 * MLB caps personIds per call, so chunk at 40.
 */
export async function getPeopleWithStats(
  personIds: number[],
  group: "hitting" | "pitching",
  season: number
): Promise<HydratedPerson[]> {
  const out: HydratedPerson[] = [];
  for (let i = 0; i < personIds.length; i += 40) {
    const chunk = personIds.slice(i, i + 40);
    if (chunk.length === 0) continue;
    const url =
      `${BASE}/people?personIds=${chunk.join(",")}` +
      `&hydrate=stats(group=[${group}],type=[season,gameLog],season=${season})`;
    const res = await fetchJson<PeopleResponse>(url);
    out.push(...(res.people ?? []));
  }
  return out;
}

export async function getTeamSeasonStats(
  teamId: number,
  group: "hitting" | "pitching",
  season: number
): Promise<Record<string, unknown> | null> {
  const url = `${BASE}/teams/${teamId}/stats?stats=season&group=${group}&season=${season}`;
  const res = await fetchJson<TeamStatsResponse>(url);
  return res.stats?.[0]?.splits?.[0]?.stat ?? null;
}

/** Final scores for a team's recent completed games (newest first). */
export async function getTeamRecentResults(
  teamId: number,
  beforeDate: string,
  days = 18
): Promise<Array<{ date: string; runsScored: number }>> {
  const end = new Date(`${beforeDate}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url =
    `${BASE}/schedule?sportId=1&teamId=${teamId}` +
    `&startDate=${fmt(start)}&endDate=${fmt(end)}&hydrate=linescore`;
  const res = await fetchJson<ScheduleResponse>(url);
  const games: Array<{ date: string; runsScored: number }> = [];
  for (const d of res.dates) {
    for (const g of d.games) {
      if (g.status.abstractGameState !== "Final") continue;
      if (d.date >= beforeDate) continue;
      const side = g.teams.home.team.id === teamId ? "home" : "away";
      const runs = g.teams[side].score ?? g.linescore?.teams?.[side]?.runs ?? 0;
      games.push({ date: d.date, runsScored: runs });
    }
  }
  return games.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Dates (newest first) of a team's last completed games before `beforeDate`. */
export async function getTeamRecentGameDates(teamId: number, beforeDate: string, n = 10): Promise<string[]> {
  const results = await getTeamRecentResults(teamId, beforeDate, 22);
  return results.slice(0, n).map((r) => r.date);
}

/** Quick reachability check for the official API. */
export async function isOfficialApiAvailable(date: string): Promise<boolean> {
  try {
    await getSchedule(date);
    return true;
  } catch {
    return false;
  }
}
