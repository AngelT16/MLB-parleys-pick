import { useEffect, useState } from "react";
import type { ModelPerformanceData, TrackedBet } from "../types/mlb";
import { mlbApi } from "../api/mlbApi";
import { formatOdds } from "../lib/format";

const RESULT_STYLES: Record<TrackedBet["result"], string> = {
  won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  lost: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  void: "bg-slate-500/15 text-slate-400 border-slate-500/40",
};

export default function ResultsTracker() {
  const [bets, setBets] = useState<TrackedBet[]>([]);
  const [performance, setPerformance] = useState<ModelPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mlbApi
      .resultsTracker()
      .then((data) => {
        setBets(data.bets);
        setPerformance(data.performance);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="card-pad text-sm text-rose-400">{error}</div>;

  return (
    <div className="space-y-6">
      {performance && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Summary label="Record" value={`${performance.record.wins}-${performance.record.losses}`} sub={`${performance.record.pending} pending · ${performance.record.voids} void`} />
          <Summary label="Win Rate" value={`${performance.winRate}%`} sub="settled bets" />
          <Summary label="ROI" value={`${performance.roi >= 0 ? "+" : ""}${performance.roi}%`} sub="flat stakes" positive={performance.roi >= 0} />
          <Summary label="Avg CLV" value={`+${performance.avgClv}%`} sub="closing line value" positive />
        </div>
      )}

      {performance && (
        <div className="card">
          <div className="border-b border-ink-700/70 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Win Rate by Market</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Pending</th>
                  <th>Win Rate</th>
                  <th>ROI</th>
                  <th>Avg CLV</th>
                </tr>
              </thead>
              <tbody>
                {performance.byMarket.map((m) => (
                  <tr key={m.market}>
                    <td className="font-medium text-slate-200">{m.market}</td>
                    <td className="text-emerald-400">{m.wins}</td>
                    <td className="text-rose-400">{m.losses}</td>
                    <td className="text-slate-400">{m.pending}</td>
                    <td className="font-semibold text-white">{m.winRate}%</td>
                    <td className={m.roi >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      {m.roi >= 0 ? "+" : ""}
                      {m.roi}%
                    </td>
                    <td className="text-sky-300">{m.avgClv >= 0 ? "+" : ""}{m.avgClv}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="border-b border-ink-700/70 px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Bet Log</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Selection</th>
                <th>Market</th>
                <th>Odds</th>
                <th>Closing</th>
                <th>CLV</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((b) => (
                <tr key={b.id}>
                  <td className="whitespace-nowrap text-slate-400">{b.date}</td>
                  <td className="font-medium text-slate-200">{b.selection}</td>
                  <td className="text-xs text-slate-400">{b.market}</td>
                  <td className="font-semibold text-slate-300">{formatOdds(b.odds)}</td>
                  <td className="text-slate-400">{formatOdds(b.closingOdds)}</td>
                  <td className={b.clv >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {b.clv >= 0 ? "+" : ""}
                    {b.clv}%
                  </td>
                  <td>
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${RESULT_STYLES[b.result]}`}>
                      {b.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, sub, positive }: { label: string; value: string; sub: string; positive?: boolean }) {
  return (
    <div className="card-pad">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold ${positive === undefined ? "text-white" : positive ? "text-emerald-400" : "text-rose-400"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{sub}</div>
    </div>
  );
}
