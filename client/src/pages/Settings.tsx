import type { AppSettings } from "../types/mlb";
import SettingsPanel from "../components/SettingsPanel";

interface Props {
  onSaved?: (settings: AppSettings) => void;
}

export default function Settings({ onSaved }: Props) {
  return (
    <div className="space-y-5">
      <p className="max-w-2xl text-sm text-slate-400">
        Tune how parlays are built. Stricter filters (higher min probability / edge) produce shorter, safer parlays;
        loosen them to let the generator reach 10 legs more often.
      </p>
      <SettingsPanel onSaved={onSaved} />
    </div>
  );
}
