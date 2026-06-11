import type { PickLeg } from "../types/mlb";
import PickExplorer from "../components/PickExplorer";

interface Props {
  picks: PickLeg[];
}

export default function TopPicks({ picks }: Props) {
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-slate-400">
        Every edge-positive pick the model scored today, ranked by confidence. Click a row for the full reasoning,
        data points and risk notes.
      </p>
      <PickExplorer picks={picks} />
    </div>
  );
}
