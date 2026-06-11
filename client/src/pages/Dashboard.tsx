import { CalendarDays, CloudSun, Cpu, ListChecks, Wand2, Zap } from "lucide-react";
import type { Game, ModelPerformanceData, Parlay, PickLeg, TwoHitCandidate } from "../types/mlb";
import StatCard from "../components/StatCard";
import GamesOverview from "../components/GamesOverview";
import ParlayCard from "../components/ParlayCard";
import Top2HitCandidates from "../components/Top2HitCandidates";
import BestPicks from "../components/BestPicks";
import ModelPerformance from "../components/ModelPerformance";
import { formatEdge } from "../lib/format";

interface Props {
  games: Game[];
  parlays: Parlay[];
  picks: PickLeg[];
  candidates: TwoHitCandidate[];
  performance: ModelPerformanceData | null;
  generating: boolean;
  onGenerate: () => void;
}

export default function Dashboard({ games, parlays, picks, candidates, performance, generating, onGenerate }: Props) {
  const confirmed = games.filter((g) => g.lineupsConfirmed).length;
  const topEdge = picks.length > 0 ? Math.max(...picks.map((p) => p.edge)) : 0;
  const weatherBoost = games.filter((g) => g.weather.impact === "boost").length;
  const weatherSuppress = games.filter((g) => g.weather.impact === "suppress").length;
  const lastUpdate = performance
    ? new Date(performance.lastModelUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard label="Games Today" value={String(games.length)} sub="MLB slate" icon={CalendarDays} accent="emerald" />
        <StatCard label="Lineups Confirmed" value={`${confirmed}/${games.length}`} sub="rest projected" icon={ListChecks} accent="sky" />
        <StatCard label="Top Edge Today" value={formatEdge(topEdge)} sub="best single pick" icon={Zap} accent="amber" />
        <StatCard label="Last Model Update" value={lastUpdate} sub="auto-refresh daily" icon={Cpu} accent="violet" />
        <StatCard
          label="Weather Impact"
          value={`${weatherBoost}▲ ${weatherSuppress}▼`}
          sub="boost / suppress games"
          icon={CloudSun}
          accent="rose"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="space-y-6 min-w-0">
          <GamesOverview games={games} />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Generated Parlays</h2>
              <button className="btn-primary" onClick={onGenerate} disabled={generating}>
                <Wand2 size={15} className={generating ? "animate-pulse" : ""} />
                {generating ? "Generating…" : "Generate New Parlays"}
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {parlays.map((p) => (
                <ParlayCard key={p.id} parlay={p} />
              ))}
              {parlays.length === 0 && (
                <div className="card-pad col-span-3 text-center text-sm text-slate-500">
                  No parlays yet — hit "Generate New Parlays".
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Top2HitCandidates candidates={candidates} />
          <BestPicks picks={picks} />
          <ModelPerformance performance={performance} />
        </div>
      </div>
    </div>
  );
}
