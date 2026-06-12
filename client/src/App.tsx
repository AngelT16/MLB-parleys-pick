import { useCallback, useEffect, useState } from "react";
import Sidebar, { type PageId } from "./components/Sidebar";
import Header from "./components/Header";
import Dashboard from "./pages/Dashboard";
import Parlays from "./pages/Parlays";
import TopPicks from "./pages/TopPicks";
import TwoHitCandidates from "./pages/TwoHitCandidates";
import MatchupAnalyzer from "./pages/MatchupAnalyzer";
import StadiumSplits from "./pages/StadiumSplits";
import ResultsTracker from "./pages/ResultsTracker";
import Settings from "./pages/Settings";
import { mlbApi } from "./api/mlbApi";
import type { DataStatus, Game, Parlay, ParlayPerformanceData, PickLeg, TwoHitCandidate } from "./types/mlb";

const PAGE_TITLES: Record<PageId, string> = {
  dashboard: "Dashboard",
  parlays: "Official Daily Parlays",
  topPicks: "Top Picks",
  twoHit: "Top 2-Hit Candidates",
  matchup: "Matchup Analyzer",
  stadium: "Stadium Splits",
  results: "Results Tracker",
  settings: "Settings",
};

export default function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [games, setGames] = useState<Game[]>([]);
  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [picks, setPicks] = useState<PickLeg[]>([]);
  const [candidates, setCandidates] = useState<TwoHitCandidate[]>([]);
  const [performance, setPerformance] = useState<ParlayPerformanceData | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [status, gamesRes, parlaysRes, picksRes, candidatesRes, perf] = await Promise.all([
        mlbApi.dataStatus(),
        mlbApi.gamesToday(),
        mlbApi.parlaysToday(),
        mlbApi.topPicks(),
        mlbApi.twoHitCandidates(),
        mlbApi.parlayPerformance(),
      ]);
      setDataStatus(status);
      setGames(gamesRes.games);
      setParlays(parlaysRes.parlays);
      setPicks(picksRes.picks);
      setCandidates(candidatesRes.candidates);
      setPerformance(perf);
    } catch (e) {
      setError(String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const generateParlays = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await mlbApi.generateParlays();
      // Show the stored official set (carries status + eligibility badges).
      setParlays(res.official ?? res.parlays);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }, []);

  const settleToday = useCallback(async () => {
    setSettling(true);
    setError(null);
    try {
      const res = await mlbApi.settleToday();
      if (res.parlays.length > 0) setParlays(res.parlays);
      setPerformance(await mlbApi.parlayPerformance());
    } catch (e) {
      setError(String(e));
    } finally {
      setSettling(false);
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar page={page} onNavigate={setPage} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header title={PAGE_TITLES[page]} dataStatus={dataStatus} refreshing={refreshing} onRefresh={loadAll} />

        <main className="flex-1 px-8 py-6">
          {error && (
            <div className="mb-5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error} — is the API server running on port 5000?
            </div>
          )}

          {page === "dashboard" && (
            <Dashboard
              games={games}
              parlays={parlays}
              picks={picks}
              candidates={candidates}
              performance={performance}
              dataStatus={dataStatus}
              generating={generating}
              settling={settling}
              onGenerate={generateParlays}
              onSettle={settleToday}
            />
          )}
          {page === "parlays" && <Parlays parlays={parlays} generating={generating} onGenerate={generateParlays} />}
          {page === "topPicks" && <TopPicks picks={picks} />}
          {page === "twoHit" && <TwoHitCandidates candidates={candidates} />}
          {page === "matchup" && <MatchupAnalyzer games={games} />}
          {page === "stadium" && <StadiumSplits games={games} />}
          {page === "results" && <ResultsTracker />}
          {page === "settings" && <Settings onSaved={() => generateParlays()} />}
        </main>

        <footer className="border-t border-ink-700/70 px-8 py-4 text-center text-xs text-slate-600">
          Predictions are for informational purposes only. No model guarantees betting results.
        </footer>
      </div>
    </div>
  );
}
