import { TrendingUp } from "lucide-react";
import type { ModelPerformanceData } from "../types/mlb";

interface Props {
  performance: ModelPerformanceData | null;
}

export default function ModelPerformance({ performance }: Props) {
  if (!performance) return null;
  const { record } = performance;

  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-3.5">
        <TrendingUp size={15} className="text-sky-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Model Performance</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-lg bg-ink-850 p-3 text-center">
          <div className="text-lg font-bold text-white">{performance.winRate}%</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Win Rate</div>
        </div>
        <div className="rounded-lg bg-ink-850 p-3 text-center">
          <div className={`text-lg font-bold ${performance.roi >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {performance.roi >= 0 ? "+" : ""}
            {performance.roi}%
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ROI</div>
        </div>
        <div className="rounded-lg bg-ink-850 p-3 text-center">
          <div className="text-lg font-bold text-sky-300">+{performance.avgClv}%</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg CLV</div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Record:{" "}
            <span className="font-semibold text-slate-200">
              {record.wins}-{record.losses}
            </span>{" "}
            ({record.pending} pending)
          </span>
          <span className="text-slate-500">
            Updated {new Date(performance.lastModelUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="mt-3 flex h-12 items-end gap-[2px]">
          {performance.last30.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.winRate}%`}
              className={`flex-1 rounded-sm ${d.winRate >= 55 ? "bg-emerald-500/60" : "bg-ink-700"}`}
              style={{ height: `${Math.max(12, d.winRate)}%` }}
            />
          ))}
        </div>
        <div className="mt-1 text-center text-[10px] text-slate-600">Daily win rate — last 30 days</div>
      </div>
    </div>
  );
}
