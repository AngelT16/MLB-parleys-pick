import { Sparkles } from "lucide-react";
import type { TwoHitCandidate } from "../types/mlb";
import { badgeClasses, edgeColor, formatEdge, formatPct } from "../lib/format";

interface Props {
  candidates: TwoHitCandidate[];
  limit?: number;
}

export default function Top2HitCandidates({ candidates, limit = 5 }: Props) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-ink-700/70 px-4 py-3.5">
        <Sparkles size={15} className="text-amber-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Top 2-Hit Candidates</h3>
      </div>
      <div className="divide-y divide-ink-800/60 px-4">
        {candidates.slice(0, limit).map((c) => (
          <div key={c.playerId} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{c.player}</div>
                <div className="text-[11px] text-slate-500">
                  {c.team} vs {c.opponent} · {c.opposingPitcher}
                </div>
              </div>
              <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeClasses[c.confidenceLabel]}`}>
                {c.confidenceLabel}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-4 text-xs">
              <span className="font-bold text-emerald-300">{formatPct(c.estimatedProbability)} 2+ hits</span>
              <span className={`font-semibold ${edgeColor(c.edge)}`}>{formatEdge(c.edge)}</span>
              <span className="text-slate-500">L5: {c.last5.split(" ")[0]}</span>
            </div>
          </div>
        ))}
        {candidates.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No candidates yet.</p>}
      </div>
    </div>
  );
}
