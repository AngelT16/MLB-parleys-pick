import type { TwoHitCandidate } from "../types/mlb";
import { badgeClasses, edgeColor, formatEdge, formatPct } from "../lib/format";

interface Props {
  candidates: TwoHitCandidate[];
}

export default function TwoHitCandidates({ candidates }: Props) {
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-slate-400">
        Hitters most likely to record 2+ hits today, ranked by estimated probability. Built from recent form,
        contact profile, the opposing pitcher and stadium history.
      </p>
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Opp</th>
              <th>Opposing Pitcher</th>
              <th>2+ Hit Prob</th>
              <th>Edge</th>
              <th>Confidence</th>
              <th>L5</th>
              <th>L10</th>
              <th>L15</th>
              <th>Stadium</th>
              <th>AVG</th>
              <th>OBP</th>
              <th>Contact</th>
              <th>K%</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.playerId}>
                <td>
                  <div className="font-semibold text-white">{c.player}</div>
                  <div className="max-w-[260px] truncate text-[11px] text-slate-500" title={c.reason}>
                    {c.reason}
                  </div>
                </td>
                <td className="text-slate-300">{c.team}</td>
                <td className="text-slate-300">{c.opponent}</td>
                <td className="text-slate-300">{c.opposingPitcher}</td>
                <td className="font-bold text-emerald-300">{formatPct(c.estimatedProbability)}</td>
                <td className={`font-semibold ${edgeColor(c.edge)}`}>{formatEdge(c.edge)}</td>
                <td>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeClasses[c.confidenceLabel]}`}>
                    {c.confidenceLabel}
                  </span>
                </td>
                <td className="whitespace-nowrap text-xs text-slate-400">{c.last5}</td>
                <td className="whitespace-nowrap text-xs text-slate-400">{c.last10}</td>
                <td className="whitespace-nowrap text-xs text-slate-400">{c.last15}</td>
                <td className="whitespace-nowrap text-xs text-slate-400">{c.stadiumHistory}</td>
                <td className="text-slate-300">{c.avg.toFixed(3)}</td>
                <td className="text-slate-300">{c.obp.toFixed(3)}</td>
                <td className="text-slate-300">{formatPct(c.contactRate, 0)}</td>
                <td className="text-slate-300">{formatPct(c.kRate, 0)}</td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={15} className="py-6 text-center text-slate-500">
                  No candidates available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
