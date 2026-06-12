import { Database, FlaskConical, RefreshCw } from "lucide-react";
import type { DataStatus } from "../types/mlb";

interface Props {
  title: string;
  dataStatus: DataStatus | null;
  refreshing: boolean;
  onRefresh: () => void;
}

function DataSourceBadge({ status }: { status: DataStatus | null }) {
  if (!status) return null;

  if (status.mockMode || status.source === "mock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
        <FlaskConical size={13} />
        Mock Mode
      </span>
    );
  }
  if (status.oddsSource === "mock") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
        <Database size={13} />
        Official MLB Data + Mock Odds
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      <Database size={13} />
      MLB Official Data: Live
    </span>
  );
}

export default function Header({ title, dataStatus, refreshing, onRefresh }: Props) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-700/70 bg-ink-950/80 px-8 py-4 backdrop-blur">
      <div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-xs text-slate-500">{today}</p>
      </div>
      <div className="flex items-center gap-3">
        {dataStatus && dataStatus.source === "mlb-official" && (
          <span className="hidden items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850 px-3 py-1 text-xs font-medium text-slate-400 md:inline-flex">
            Lineups Confirmed: {dataStatus.lineupsConfirmed}/{dataStatus.totalGames}
          </span>
        )}
        <DataSourceBadge status={dataStatus} />
        <button className="btn-secondary" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>
    </header>
  );
}
