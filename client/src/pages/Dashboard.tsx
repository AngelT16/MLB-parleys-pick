import { CalendarDays, Database, ListChecks, UserCheck, Wand2, Zap } from "lucide-react";
import type { DataStatus, Game, Parlay, ParlayPerformanceData, PickLeg, TwoHitCandidate } from "../types/mlb";
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
  performance: ParlayPerformanceData | null;
  dataStatus: DataStatus | null;
  generating: boolean;
  settling: boolean;
  onGenerate: () => void;
  onSettle: () => void;
}

export default function Dashboard({
  games,
  parlays,
  picks,
  candidates,
  performance,
  dataStatus,
  generating,
  settling,
  onGenerate,
  onSettle,
}: Props) {
  const confirmed = games.filter((g) => g.lineupsConfirmed).length;
  const topEdge = picks.length > 0 ? Math.max(...picks.map((p) => p.edge)) : 0;
  const officialData = dataStatus?.source === "mlb-official";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <StatCard
          label="Data Source"
          value={officialData ? "MLB Official" : "Mock"}
          sub={officialData ? "statsapi.mlb.com + mock odds" : dataStatus?.officialError ? "official API unreachable" : "demo data"}
          icon={Database}
          accent={officialData ? "emerald" : "violet"}
        />
        <StatCard label="Games Today" value={String(games.length)} sub="MLB slate" icon={CalendarDays} accent="emerald" />
        <StatCard label="Lineups Confirmed" value={`${confirmed}/${games.length}`} sub="rest projected" icon={ListChecks} accent="sky" />
        <StatCard
          label="Projected Regulars Used"
          value={String(dataStatus?.projectedRegularsUsed ?? 0)}
          sub="unconfirmed lineups only"
          icon={UserCheck}
          accent="violet"
        />
        <StatCard label="Top Edge Today" value={formatEdge(topEdge)} sub="best single pick" icon={Zap} accent="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_330px]">
        <div className="space-y-6 min-w-0">
          <GamesOverview games={games} />

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Official Daily Parlays</h2>
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
          <ModelPerformance performance={performance} settling={settling} onSettle={onSettle} />
          <Top2HitCandidates candidates={candidates} />
          <BestPicks picks={picks} />
        </div>
      </div>
    </div>
  );
}
