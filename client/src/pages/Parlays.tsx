import { Wand2 } from "lucide-react";
import type { Parlay } from "../types/mlb";
import ParlayCard from "../components/ParlayCard";

interface Props {
  parlays: Parlay[];
  generating: boolean;
  onGenerate: () => void;
}

export default function Parlays({ parlays, generating, onGenerate }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="max-w-xl text-sm text-slate-400">
          Three daily parlays built from the highest-probability, edge-positive picks on the board. Markets are never
          forced — the model only takes what the slate gives.
        </p>
        <button className="btn-primary" onClick={onGenerate} disabled={generating}>
          <Wand2 size={15} className={generating ? "animate-pulse" : ""} />
          {generating ? "Generating…" : "Generate New Parlays"}
        </button>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {parlays.map((p) => (
          <ParlayCard key={p.id} parlay={p} defaultExpanded />
        ))}
        {parlays.length === 0 && (
          <div className="card-pad col-span-3 text-center text-sm text-slate-500">No parlays generated yet.</div>
        )}
      </div>
    </div>
  );
}
