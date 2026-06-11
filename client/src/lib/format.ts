import type { ConfidenceLabel } from "../types/mlb";

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatPct(p: number, digits = 1): string {
  return `${(p * 100).toFixed(digits)}%`;
}

export function formatEdge(edge: number): string {
  const pct = (edge * 100).toFixed(1);
  return edge >= 0 ? `+${pct}%` : `${pct}%`;
}

export const badgeClasses: Record<ConfidenceLabel, string> = {
  Elite: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  Strong: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  Playable: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  Avoid: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

export function edgeColor(edge: number): string {
  if (edge >= 0.04) return "text-emerald-400";
  if (edge >= 0.015) return "text-emerald-300/80";
  if (edge >= 0) return "text-slate-300";
  return "text-rose-400";
}

export function parlayToClipboard(name: string, legs: { selection: string; market: string; game: string; odds: number }[], combinedOdds: number): string {
  const lines = legs.map(
    (l, i) => `${i + 1}. ${l.selection} (${l.market}) — ${l.game} — ${formatOdds(l.odds)}`
  );
  return [`${name} — Combined ${formatOdds(combinedOdds)}`, ...lines].join("\n");
}
