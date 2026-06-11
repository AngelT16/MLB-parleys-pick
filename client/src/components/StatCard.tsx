import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: "emerald" | "sky" | "amber" | "violet" | "rose";
}

const ACCENTS = {
  emerald: "bg-emerald-500/15 text-emerald-400",
  sky: "bg-sky-500/15 text-sky-400",
  amber: "bg-amber-500/15 text-amber-400",
  violet: "bg-violet-500/15 text-violet-400",
  rose: "bg-rose-500/15 text-rose-400",
};

export default function StatCard({ label, value, sub, icon: Icon, accent = "emerald" }: Props) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ACCENTS[accent]}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate text-xl font-bold text-white">{value}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}
