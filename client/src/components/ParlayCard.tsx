import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Flame, Scale, Shield } from "lucide-react";
import type { Parlay } from "../types/mlb";
import { badgeClasses, edgeColor, formatEdge, formatOdds, formatPct, parlayToClipboard } from "../lib/format";

interface Props {
  parlay: Parlay;
  defaultExpanded?: boolean;
}

const TYPE_META = {
  conservative: { icon: Shield, color: "text-emerald-400", ring: "ring-emerald-500/30", label: "Conservative" },
  balanced: { icon: Scale, color: "text-sky-400", ring: "ring-sky-500/30", label: "Balanced" },
  aggressive: { icon: Flame, color: "text-rose-400", ring: "ring-rose-500/30", label: "Aggressive" },
};

export default function ParlayCard({ parlay, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);
  const meta = TYPE_META[parlay.type];
  const Icon = meta.icon;

  async function copyParlay() {
    const text = parlayToClipboard(parlay.name, parlay.legs, parlay.combinedOdds);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API can fail in iframes (Replit preview) - fall back to a textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={`card ring-1 ${meta.ring}`}>
      <div className="flex items-start justify-between gap-3 border-b border-ink-700/70 p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-ink-850 ${meta.color}`}>
            <Icon size={19} />
          </div>
          <div>
            <div className="text-sm font-bold text-white">{parlay.name}</div>
            <div className="text-xs text-slate-500">
              {parlay.legs.length} legs · model {formatPct(parlay.modelProbability, 2)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{formatOdds(parlay.combinedOdds)}</div>
          <div className={`text-xs font-semibold ${edgeColor(parlay.edge)}`}>{formatEdge(parlay.edge)} edge</div>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto px-4 py-2">
        {parlay.legs.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">
            No edge-positive legs passed the filters today.
          </p>
        )}
        {parlay.legs.map((leg, i) => (
          <div key={leg.id} className="border-b border-ink-800/60 py-2.5 last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-200">
                  <span className="mr-1.5 text-xs text-slate-600">{i + 1}.</span>
                  {leg.selection}
                </div>
                <div className="truncate text-[11px] text-slate-500">
                  {leg.market} · {leg.game}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badgeClasses[leg.confidenceLabel]}`}>
                  {leg.confidenceLabel}
                </span>
                <span className="w-12 text-right text-sm font-semibold text-slate-300">{formatOdds(leg.odds)}</span>
              </div>
            </div>
            {expanded && (
              <div className="mt-2 rounded-lg bg-ink-850/70 p-3 text-xs">
                <div className="mb-2 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-slate-500">Implied</div>
                    <div className="font-semibold text-slate-300">{formatPct(leg.impliedProbability)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Model</div>
                    <div className="font-semibold text-slate-200">{formatPct(leg.modelProbability)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Edge</div>
                    <div className={`font-semibold ${edgeColor(leg.edge)}`}>{formatEdge(leg.edge)}</div>
                  </div>
                </div>
                <p className="mb-2 leading-relaxed text-slate-400">{leg.reason}</p>
                <ul className="mb-2 list-inside list-disc space-y-0.5 text-slate-500">
                  {leg.dataPoints.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <p className="text-amber-400/80">⚠ {leg.riskNote}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-ink-700/70 p-3">
        <button className="btn-secondary flex-1 justify-center" onClick={copyParlay} disabled={parlay.legs.length === 0}>
          {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
          {copied ? "Copied!" : "Copy Parlay"}
        </button>
        <button className="btn-secondary flex-1 justify-center" onClick={() => setExpanded((e) => !e)}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          {expanded ? "Hide Details" : "View Details"}
        </button>
      </div>
    </div>
  );
}
