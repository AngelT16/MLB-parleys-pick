import { CheckCircle2, Clock3, Wind } from "lucide-react";
import type { Game } from "../types/mlb";
import { formatOdds } from "../lib/format";

interface Props {
  games: Game[];
}

const IMPACT_STYLES = {
  boost: "text-emerald-400",
  neutral: "text-slate-400",
  suppress: "text-sky-400",
};

export default function GamesOverview({ games }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-ink-700/70 px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">Today's Games Overview</h2>
        <span className="text-xs text-slate-500">{games.length} games</span>
      </div>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Matchup</th>
              <th>Time (ET)</th>
              <th>Probable Pitchers</th>
              <th>ML</th>
              <th>Total</th>
              <th>Weather</th>
              <th>Lineups</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id}>
                <td>
                  <div className="font-semibold text-white">
                    {g.away.abbr} @ {g.home.abbr}
                  </div>
                  <div className="text-xs text-slate-500">{g.stadium.name}</div>
                </td>
                <td className="text-slate-300">{g.startTimeET}</td>
                <td>
                  <div className="text-xs text-slate-300">
                    {g.awayPitcher.name} <span className="text-slate-500">({g.awayPitcher.era.toFixed(2)})</span>
                  </div>
                  <div className="text-xs text-slate-300">
                    {g.homePitcher.name} <span className="text-slate-500">({g.homePitcher.era.toFixed(2)})</span>
                  </div>
                </td>
                <td>
                  <div className="text-xs font-medium text-slate-300">{g.away.abbr} {formatOdds(g.odds.awayML)}</div>
                  <div className="text-xs font-medium text-slate-300">{g.home.abbr} {formatOdds(g.odds.homeML)}</div>
                </td>
                <td className="font-semibold text-slate-200">{g.odds.total}</td>
                <td>
                  <div className={`flex items-center gap-1.5 text-xs ${IMPACT_STYLES[g.weather.impact]}`}>
                    <Wind size={13} />
                    {g.weather.condition}, {g.weather.tempF}°F
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Wind {g.weather.windMph} mph {g.weather.windDirection}
                  </div>
                </td>
                <td>
                  {g.lineupsConfirmed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <CheckCircle2 size={13} /> Confirmed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                      <Clock3 size={13} /> Projected
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
