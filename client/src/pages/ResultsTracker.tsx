import { useCallback, useEffect, useState } from "react";
import { CheckCheck, Flame, Scale, Shield } from "lucide-react";
import type { LegResult, Parlay, ParlayPerformanceData, ParlayStatus, RiskMode } from "../types/mlb";
import { mlbApi } from "../api/mlbApi";
import { formatOdds } from "../lib/format";

const STATUS_STYLES: Record<ParlayStatus, string> = {
  WON: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  LOST: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  VOID: "bg-slate-500/15 text-slate-400 border-slate-500/40",
};

const LEG_ICONS: Record<LegResult, string> = { won: "✅", lost: "❌", void: "➖", pending: "⏳" };

const TYPE_ICONS: Record<RiskMode, typeof Shield> = {
  conservative: Shield,
  balanced: Scale,
  aggressive: Flame,
};

export default function ResultsTracker() {
  const [history, setHistory] = useState<Array<{ date: string; parlays: Parlay[] }>>([]);
  const [performance, setPerformance] = useState<ParlayPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [historyRes, perf] = await Promise.all([mlbApi.resultsHistory(), mlbApi.parlayPerformance()]);
      setHistory(historyRes.history);
      setPerformance(perf);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const settleToday = useCallback(async () => {
    setSettling(true);
    setError(null);
    setNotice(null);
    try {
      const res = await mlbApi.settleToday();
      setNotice(
        res.parlays.length === 0
          ? "No official parlays stored for today yet — generate parlays first."
          : `Settled ${res.settled} legs across ${res.parlays.length} parlays.`
      );
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSettling(false);
    }
  }, [load]);

  if (error && history.length === 0) return <div className="card-pad text-sm text-rose-400">{error}</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {notice && <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-300">{notice}</div>}

      {performance && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Summary
            label="Parlay Record"
            value={`${performance.record.wins}-${performance.record.losses}`}
            sub={`${performance.record.pending} pending · ${performance.record.voids} void`}
          />
          <Summary label="Parlay Win Rate" value={`${performance.winRate}%`} sub="full parlays, not legs" />
          <Summary
            label="Parlay ROI"
            value={`${performance.roi >= 0 ? "+" : ""}${performance.roi}%`}
            sub="flat 1-unit stakes"
            positive={performance.roi >= 0}
          />
          <Summary label="Avg CLV" value={performance.avgClv === null ? "N/A" : `+${performance.avgClv}%`} sub="needs live odds feed" />
        </div>
      )}

      {performance && (
        <div className="card">
          <div className="flex items-center justify-between border-b border-ink-700/70 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Record by Parlay Type</h2>
            <button className="btn-primary" onClick={settleToday} disabled={settling}>
              <CheckCheck size={15} className={settling ? "animate-pulse" : ""} />
              {settling ? "Settling…" : "Settle Today's Parlays"}
            </button>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {performance.byType.map((t) => {
              const Icon = TYPE_ICONS[t.type];
              return (
                <div key={t.type} className="rounded-lg bg-ink-850 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <Icon size={14} />
                    {t.type}
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">
                    {t.wins}-{t.losses}
                    <span className="ml-2 text-xs font-medium text-slate-500">({t.pending} pending)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Daily Official Parlays</h2>
        {history.length === 0 && (
          <div className="card-pad text-center text-sm text-slate-500">
            No official parlays saved yet. Generate today's parlays from the Dashboard — they are stored automatically
            and settled here at the end of the day.
          </div>
        )}
        {history.map((day) => (
          <div key={day.date} className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              {day.parlays.map((p) => (
                <ParlayResultCard key={p.id} parlay={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParlayResultCard({ parlay }: { parlay: Parlay }) {
  const status = parlay.status ?? "PENDING";
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2 border-b border-ink-700/70 p-4">
        <div>
          <div className="text-sm font-bold text-white">{parlay.name}</div>
          <div className="mt-0.5 text-xs text-slate-500">
            Total Odds: <span className="font-semibold text-slate-300">{formatOdds(parlay.combinedOdds)}</span>
          </div>
          {parlay.resultReason && <div className="mt-0.5 text-xs text-slate-400">Reason: {parlay.resultReason}</div>}
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[status]}`}>
          {status === "PENDING" ? "Pending Results" : status}
        </span>
      </div>
      <div className="px-4 py-2">
        {parlay.legs.map((leg) => (
          <div key={leg.id} className="flex items-center justify-between gap-2 border-b border-ink-800/60 py-2 text-sm last:border-0">
            <div className="min-w-0">
              <span className="mr-1.5">{LEG_ICONS[leg.result ?? "pending"]}</span>
              <span className="text-slate-200">{leg.selection}</span>
              <div className="ml-6 text-[11px] text-slate-500">
                {leg.game}
                {leg.lineupStatus === "CONFIRMED" && <span className="ml-1.5 text-emerald-400/80">· Confirmed Lineup</span>}
                {leg.lineupStatus === "PROJECTED_REGULAR" && <span className="ml-1.5 text-sky-400/80">· Projected Regular</span>}
              </div>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-400">{formatOdds(leg.odds)}</span>
          </div>
        ))}
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
