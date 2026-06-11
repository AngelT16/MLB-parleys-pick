import { useEffect, useState } from "react";
import type { Game, StadiumSplitsData } from "../types/mlb";
import { mlbApi } from "../api/mlbApi";

interface Props {
  games: Game[];
}

export default function StadiumSplits({ games }: Props) {
  const stadiums = games.map((g) => g.stadium);
  const [stadiumId, setStadiumId] = useState<string>("");
  const [data, setData] = useState<StadiumSplitsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stadiumId && stadiums.length > 0) setStadiumId(stadiums[0].id);
  }, [stadiums, stadiumId]);

  useEffect(() => {
    if (!stadiumId) return;
    setLoading(true);
    setError(null);
    mlbApi
      .stadiumSplits(stadiumId)
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [stadiumId]);

  return (
    <div className="space-y-5">
      <div className="max-w-xl">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Select stadium</label>
        <select className="input-base" value={stadiumId} onChange={(e) => setStadiumId(e.target.value)}>
          {stadiums.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.teamAbbr})
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="card-pad text-sm text-slate-500">Loading splits…</div>}
      {error && <div className="card-pad text-sm text-rose-400">{error}</div>}

      {data && !loading && (
        <div className="max-w-3xl space-y-5">
          <div className="card-pad">
            <h3 className="mb-1 text-base font-bold text-white">{data.stadium.name}</h3>
            <p className="mb-4 text-xs text-slate-500">
              Home of {data.stadium.teamAbbr} · Roof: {data.stadium.roof}
              {data.todayGame && <> · Today: {data.todayGame}</>}
            </p>
            <div className="grid grid-cols-3 gap-4">
              <Factor label="Hit Factor" value={data.splits.hitFactor} />
              <Factor label="Run Factor" value={data.splits.runFactor} />
              <Factor label="HR Factor" value={data.splits.hrFactor} />
            </div>
            <p className="mt-4 text-sm text-slate-400">{data.splits.notes}</p>
          </div>

          {data.weather && (
            <div className="card-pad">
              <h4 className="mb-2 text-sm font-bold text-white">Today's Weather</h4>
              <p className="text-sm text-slate-400">
                {data.weather.condition}, {data.weather.tempF}°F · wind {data.weather.windMph} mph {data.weather.windDirection} · offense impact:{" "}
                <b
                  className={
                    data.weather.impact === "boost"
                      ? "text-emerald-400"
                      : data.weather.impact === "suppress"
                        ? "text-sky-400"
                        : "text-slate-300"
                  }
                >
                  {data.weather.impact}
                </b>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Factor({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, (value - 0.8) * 250));
  const color = value >= 1.03 ? "bg-emerald-500" : value <= 0.94 ? "bg-sky-500" : "bg-slate-500";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="text-sm font-bold text-white">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
