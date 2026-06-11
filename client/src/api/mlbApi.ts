import type {
  AppSettings,
  Game,
  ModelPerformanceData,
  Parlay,
  PickLeg,
  PlayerMatchup,
  StadiumSplitsData,
  TrackedBet,
  TwoHitCandidate,
} from "../types/mlb";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export const mlbApi = {
  health: () => request<{ status: string; mockMode: boolean; time: string }>("/api/health"),

  gamesToday: () => request<{ date: string; games: Game[] }>("/api/mlb/games/today"),

  oddsToday: () => request<{ date: string; odds: unknown[] }>("/api/mlb/odds/today"),

  parlaysToday: () => request<{ date: string; parlays: Parlay[] }>("/api/mlb/parlays/today"),

  generateParlays: (overrides?: Partial<AppSettings>) =>
    request<{ date: string; parlays: Parlay[] }>("/api/mlb/parlays/generate", {
      method: "POST",
      body: JSON.stringify(overrides ?? {}),
    }),

  topPicks: () => request<{ date: string; picks: PickLeg[] }>("/api/mlb/picks/top"),

  twoHitCandidates: () =>
    request<{ date: string; candidates: TwoHitCandidate[] }>("/api/mlb/picks/top-2-hit-candidates"),

  playerMatchup: (id: string) => request<PlayerMatchup>(`/api/mlb/player/${id}/matchup`),

  stadiumSplits: (id: string) => request<StadiumSplitsData>(`/api/mlb/stadium/${id}/splits`),

  getSettings: () => request<AppSettings>("/api/mlb/settings"),

  saveSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>("/api/mlb/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),

  resultsTracker: () =>
    request<{ date: string; bets: TrackedBet[]; performance: ModelPerformanceData }>("/api/mlb/results/tracker"),

  modelPerformance: () => request<ModelPerformanceData>("/api/mlb/model/performance"),
};
