import type { Game, Parlay, Pick, TwoHitCandidate } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function loadDashboardData() {
  const [games, parlays, topPicks, twoHitCandidates, settings] = await Promise.all([
    getJson<Game[]>("/api/mlb/games/today"),
    getJson<Parlay[]>("/api/mlb/parlays/today"),
    getJson<Pick[]>("/api/mlb/picks/top"),
    getJson<TwoHitCandidate[]>("/api/mlb/picks/top-2-hit-candidates"),
    getJson<{ lastModelUpdate: string; mockMode: boolean }>("/api/mlb/settings")
  ]);

  return { games, parlays, topPicks, twoHitCandidates, settings };
}

export async function generateParlays() {
  return getJson<Parlay[]>("/api/mlb/parlays/generate");
}
