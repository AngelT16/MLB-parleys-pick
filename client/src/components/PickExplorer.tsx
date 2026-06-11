import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ConfidenceLabel, Market, PickLeg } from "../types/mlb";
import { badgeClasses, edgeColor, formatEdge, formatOdds, formatPct } from "../lib/format";

interface Props {
  picks: PickLeg[];
}

const MARKETS: ("All" | Market)[] = [
  "All",
  "Moneyline",
  "Batter to record a hit",
  "Batter 2+ total bases",
  "Pitcher strikeouts over/under",
  "First 5 innings over/under",
  "Full game total over/under",
];

const LABELS: ("All" | ConfidenceLabel)[] = ["All", "Elite", "Strong", "Playable", "Avoid"];

export default function PickExplorer({ picks }: Props) {
  const [market, setMarket] = useState<(typeof MARKETS)[number]>("All");
  const [label, setLabel] = useState<(typeof LABELS)[number]>("All");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      picks
        .filter((p) => market === "All" || p.market === market)
        .filter((p) => label === "All" || p.confidenceLabel === label),
    [picks, market, label]
  );

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-700/70 px-5 py-4">
        <h2 className="mr-auto text-sm font-bold uppercase tracking-wider text-slate-300">Pick Explorer</h2>
        <select className="input-base w-auto" value={market} onChange={(e) => setMarket(e.target.value as typeof market)}>
          {MARKETS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <select className="input-base w-auto" value={label} onChange={(e) => setLabel(e.target.value as typeof label)}>
          {LABELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th></th>
              <th>Selection</th>
              <th>Market</th>
              <th>Game</th>
              <th>Odds</th>
              <th>Implied</th>
              <th>Model</th>
              <th>Edge</th>
              <th>Score</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <PickRow key={p.id} pick={p} open={openId === p.id} onToggle={() => setOpenId(openId === p.id ? null : p.id)} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-slate-500">
                  No picks match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PickRow({ pick, open, onToggle }: { pick: PickLeg; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td className="w-8 text-slate-500">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
        <td className="font-medium text-white">{pick.selection}</td>
        <td className="text-xs text-slate-400">{pick.market}</td>
        <td className="text-slate-300">{pick.game}</td>
        <td className="font-semibold text-slate-200">{formatOdds(pick.odds)}</td>
        <td className="text-slate-400">{formatPct(pick.impliedProbability)}</td>
        <td className="text-slate-200">{formatPct(pick.modelProbability)}</td>
        <td className={`font-semibold ${edgeColor(pick.edge)}`}>{formatEdge(pick.edge)}</td>
        <td className="text-slate-300">{pick.confidenceScore}</td>
        <td>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeClasses[pick.confidenceLabel]}`}>
            {pick.confidenceLabel}
          </span>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} className="bg-ink-850/50">
            <div className="space-y-2 p-3 text-xs">
              <p className="leading-relaxed text-slate-300">{pick.reason}</p>
              <ul className="list-inside list-disc space-y-0.5 text-slate-500">
                {pick.dataPoints.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <p className="text-amber-400/80">⚠ {pick.riskNote}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
