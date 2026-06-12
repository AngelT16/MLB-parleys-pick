import { CheckCheck, TrendingUp } from "lucide-react";
import type { ParlayPerformanceData, ParlayTypeRecord } from "../types/mlb";

interface Props {
  performance: ParlayPerformanceData | null;
  settling?: boolean;
  onSettle?: () => void;
}

const TYPE_LABELS: Record<ParlayTypeRecord["type"], string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

function recordLabel(r: { wins: number; losses: number; pending: number }): string {
  return `${r.wins}-${r.losses} (${r.pending} pending)`;
}

/**
 * Headline model performance card. Measures FULL parlays won/lost - a parlay
 * only counts as a win when every leg hits. Individual legs are never the
 * primary metric.
 */
export default function ModelPerformance({ performance, settling = false, onSettle }: Props) {
  if (!performance) return null;
  const { record } = performance;
  const hasHistory = performance.totalParlays > 0;

  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-3.5">
        <TrendingUp size={15} className="text-sky-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Parlay Performance</h3>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-lg bg-ink-850 p-3 text-center">
          <div className="text-lg font-bold text-white">{hasHistory ? `${performance.winRate}%` : "—"}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Parlay Win Rate</div>
        </div>
        <div className="rounded-lg bg-ink-850 p-3 text-center">
          <div className={`text-lg font-bold ${performance.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {hasHistory ? `${performance.roi >= 0 ? "+" : ""}${performance.roi}%` : "—"}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Parlay ROI</div>
        </div>
        <div className="rounded-lg bg-ink-850 p-3 text-center">
          <div className="text-lg font-bold text-slate-400">{performance.avgClv === null ? "N/A" : `+${performance.avgClv}%`}</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg CLV</div>
        </div>
      </div>

      <div className="px-4 pb-2">
        <div className="text-xs text-slate-400">
          Parlay Record:{" "}
          <span className="font-semibold text-slate-200">{recordLabel(record)}</span>
          {record.voids > 0 && <span className="text-slate-500"> · {record.voids} void</span>}
        </div>
      </div>

      <div className="space-y-1.5 px-4 pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">By Type</div>
        {performance.byType.map((t) => (
          <div key={t.type} className="flex items-center justify-between rounded-md bg-ink-850/70 px-3 py-1.5 text-xs">
            <span className="text-slate-300">{TYPE_LABELS[t.type]}</span>
            <span className="font-semibold text-slate-200">{recordLabel(t)}</span>
          </div>
        ))}
        {!hasHistory && (
          <p className="pt-1 text-[11px] text-slate-500">
            No official parlays tracked yet — generate today's parlays, then settle them after the games.
          </p>
        )}
      </div>

      {onSettle && (
        <div className="border-t border-ink-700/70 p-3">
          <button className="btn-primary w-full justify-center" onClick={onSettle} disabled={settling}>
            <CheckCheck size={15} className={settling ? "animate-pulse" : ""} />
            {settling ? "Settling…" : "Settle Today's Parlays"}
          </button>
        </div>
      )}
    </div>
  );
}
