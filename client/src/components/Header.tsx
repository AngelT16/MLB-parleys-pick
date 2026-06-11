import { FlaskConical, RefreshCw } from "lucide-react";

interface Props {
  title: string;
  mockMode: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function Header({ title, mockMode, refreshing, onRefresh }: Props) {
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
        {mockMode && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
            <FlaskConical size={13} />
            Mock Mode
          </span>
        )}
        <button className="btn-secondary" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          Refresh Data
        </button>
      </div>
    </header>
  );
}
