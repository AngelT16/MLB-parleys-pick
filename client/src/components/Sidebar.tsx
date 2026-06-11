import {
  BarChart3,
  ClipboardList,
  Layers,
  LayoutDashboard,
  Settings as SettingsIcon,
  Sparkles,
  Swords,
  Target,
  Warehouse,
} from "lucide-react";

export type PageId =
  | "dashboard"
  | "parlays"
  | "topPicks"
  | "twoHit"
  | "matchup"
  | "stadium"
  | "results"
  | "settings";

const NAV: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "parlays", label: "Parlays", icon: Layers },
  { id: "topPicks", label: "Top Picks", icon: Target },
  { id: "twoHit", label: "2-Hit Candidates", icon: Sparkles },
  { id: "matchup", label: "Matchup Analyzer", icon: Swords },
  { id: "stadium", label: "Stadium Splits", icon: Warehouse },
  { id: "results", label: "Results Tracker", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

interface Props {
  page: PageId;
  onNavigate: (page: PageId) => void;
}

export default function Sidebar({ page, onNavigate }: Props) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-ink-700/70 bg-ink-900/80 backdrop-blur sticky top-0">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <BarChart3 size={20} />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide text-white">MLB PARLEYS</div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">Pick Engine</div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              page === id
                ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
                : "text-slate-400 hover:bg-ink-850 hover:text-slate-200"
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4">
        <div className="rounded-lg border border-ink-700/70 bg-ink-850 p-3 text-[11px] leading-relaxed text-slate-500">
          Predictions are for informational purposes only. No model guarantees betting results.
        </div>
      </div>
    </aside>
  );
}
