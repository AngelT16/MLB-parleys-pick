import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import type { AppSettings } from "../types/mlb";
import { mlbApi } from "../api/mlbApi";

interface Props {
  onSaved?: (settings: AppSettings) => void;
}

export default function SettingsPanel({ onSaved }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mlbApi.getSettings().then(setSettings).catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="card-pad text-sm text-rose-400">{error}</div>;
  if (!settings) return <div className="card-pad text-sm text-slate-500">Loading settings…</div>;

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await mlbApi.saveSettings(settings);
      setSettings(saved);
      setSavedAt(Date.now());
      onSaved?.(saved);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-pad max-w-2xl space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Min legs" value={settings.minLegs} min={2} max={10} step={1} onChange={(v) => update("minLegs", v)} />
        <NumberField label="Max legs" value={settings.maxLegs} min={2} max={12} step={1} onChange={(v) => update("maxLegs", v)} />
        <NumberField
          label="Min probability"
          value={settings.minProbability}
          min={0}
          max={0.95}
          step={0.05}
          onChange={(v) => update("minProbability", v)}
        />
        <NumberField label="Min edge" value={settings.minEdge} min={-0.1} max={0.2} step={0.005} onChange={(v) => update("minEdge", v)} />
        <NumberField
          label="Max picks per game"
          value={settings.maxPicksPerGame}
          min={1}
          max={6}
          step={1}
          onChange={(v) => update("maxPicksPerGame", v)}
        />
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Risk mode</label>
          <select
            className="input-base"
            value={settings.riskMode}
            onChange={(e) => update("riskMode", e.target.value as AppSettings["riskMode"])}
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 border-t border-ink-700/70 pt-4">
        <ToggleField
          label="Allow correlation"
          help="Permit correlated same-game legs when their score stays high."
          checked={settings.allowCorrelation}
          onChange={(v) => update("allowCorrelation", v)}
        />
        <ToggleField
          label="Exclude unconfirmed lineups"
          help="Skip all picks from games whose lineups are not confirmed yet."
          checked={settings.excludeUnconfirmedLineups}
          onChange={(v) => update("excludeUnconfirmedLineups", v)}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-ink-700/70 pt-4">
        <button className="btn-primary" onClick={save} disabled={saving}>
          <Save size={15} />
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Saved ✓</span>}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      <input
        type="number"
        className="input-base"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ToggleField({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-emerald-500" : "bg-ink-700"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="block text-xs text-slate-500">{help}</span>
      </span>
    </label>
  );
}
