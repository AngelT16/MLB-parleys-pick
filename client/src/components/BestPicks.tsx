import { Target } from "lucide-react";
import type { PickLeg } from "../types/mlb";
import { badgeClasses, edgeColor, formatEdge, formatOdds, formatPct } from "../lib/format";

interface Props {
  picks: PickLeg[];
  limit?: number;
}

export default function BestPicks({ picks, limit = 5 }: Props) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-3.5">
        <Target size={15} className="text-emerald-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Best Picks Today</h3>
      </div>
      <div className="divide-y divide-ink-800/60 px-4">
        {picks.slice(0, limit).map((p) => (
          <div key={p.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{p.selection}</div>
                <div className="truncate text-[11px] text-slate-500">
                  {p.market} · {p.game}
                </div>
              </div>
              <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeClasses[p.confidenceLabel]}`}>
                {p.confidenceLabel}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-4 text-xs">
              <span className="font-semibold text-slate-300">{formatOdds(p.odds)}</span>
              <span className="text-slate-400">{formatPct(p.modelProbability)} model</span>
              <span className={`font-semibold ${edgeColor(p.edge)}`}>{formatEdge(p.edge)}</span>
            </div>
          </div>
        ))}
        {picks.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No picks available.</p>}
      </div>
    </div>
  );
}
