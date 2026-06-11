import { useEffect, useMemo, useState } from "react";
import type { Game, PlayerMatchup } from "../types/mlb";
import { mlbApi } from "../api/mlbApi";
import { formatPct } from "../lib/format";

interface Props {
  games: Game[];
}

export default function MatchupAnalyzer({ games }: Props) {
  const players = useMemo(
    () =>
      games.flatMap((g) => [
        ...g.awayLineup.map((b) => ({ id: b.id, label: `${b.name} (${b.teamAbbr}) — ${g.away.abbr} @ ${g.home.abbr}` })),
        ...g.homeLineup.map((b) => ({ id: b.id, label: `${b.name} (${b.teamAbbr}) — ${g.away.abbr} @ ${g.home.abbr}` })),
      ]),
    [games]
  );

  const [playerId, setPlayerId] = useState<string>("");
  const [matchup, setMatchup] = useState<PlayerMatchup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId && players.length > 0) setPlayerId(players[0].id);
  }, [players, playerId]);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    mlbApi
      .playerMatchup(playerId)
      .then(setMatchup)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [playerId]);

  return (
    <div className="space-y-5">
      <div className="max-w-xl">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Select batter</label>
        <select className="input-base" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {loading && <div className="card-pad text-sm text-slate-500">Loading matchup…</div>}
      {error && <div className="card-pad text-sm text-rose-400">{error}</div>}

      {matchup && !loading && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card-pad">
            <h3 className="mb-3 text-sm font-bold text-white">
              {matchup.batter.name}
              <span className="ml-2 text-xs font-medium text-slate-500">
                {matchup.batter.teamAbbr} · #{matchup.batter.lineupSpot} · {matchup.batter.position} · Bats {matchup.batter.bats}
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="AVG" value={matchup.batter.avg.toFixed(3)} />
              <Stat label="OBP" value={matchup.batter.obp.toFixed(3)} />
              <Stat label="SLG" value={matchup.batter.slg.toFixed(3)} />
              <Stat label="xBA" value={matchup.batter.xba.toFixed(3)} />
              <Stat label="Contact" value={formatPct(matchup.batter.contactRate, 0)} />
              <Stat label="K rate" value={formatPct(matchup.batter.kRate, 0)} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm text-slate-400">
              <p>
                Last 5: <b className="text-slate-200">{matchup.batter.last5.hits}-for-{matchup.batter.last5.atBats}</b> ({matchup.batter.last5.avg.toFixed(3)})
              </p>
              <p>
                Last 10: <b className="text-slate-200">{matchup.batter.last10.hits}-for-{matchup.batter.last10.atBats}</b> ({matchup.batter.last10.avg.toFixed(3)})
              </p>
              <p>
                Last 15: <b className="text-slate-200">{matchup.batter.last15.hits}-for-{matchup.batter.last15.atBats}</b> ({matchup.batter.last15.avg.toFixed(3)})
              </p>
              <p>
                vs {matchup.opposingPitcher.name}:{" "}
                <b className="text-slate-200">
                  {matchup.batter.vsPitcher.hits}-for-{matchup.batter.vsPitcher.atBats}
                </b>{" "}
                {matchup.batter.vsPitcher.atBats > 0 && `(${matchup.batter.vsPitcher.avg.toFixed(3)})`}
              </p>
              <p>
                At {matchup.stadium.name}: <b className="text-slate-200">{matchup.batter.stadiumAvg.toFixed(3)}</b> in {matchup.batter.stadiumGames} games
              </p>
            </div>
          </div>

          <div className="card-pad">
            <h3 className="mb-3 text-sm font-bold text-white">
              vs {matchup.opposingPitcher.name}
              <span className="ml-2 text-xs font-medium text-slate-500">
                {matchup.opposingPitcher.teamAbbr} · Throws {matchup.opposingPitcher.throws}
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="ERA" value={matchup.opposingPitcher.era.toFixed(2)} />
              <Stat label="WHIP" value={matchup.opposingPitcher.whip.toFixed(2)} />
              <Stat label="K/9" value={matchup.opposingPitcher.kPer9.toFixed(1)} />
              <Stat label="AVG allowed" value={matchup.opposingPitcher.avgAllowed.toFixed(3)} />
              <Stat label="SLG allowed" value={matchup.opposingPitcher.slgAllowed.toFixed(3)} />
              <Stat label="Whiff" value={formatPct(matchup.opposingPitcher.whiffRate, 0)} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm text-slate-400">
              <p>
                Game: <b className="text-slate-200">{matchup.game.label}</b> · {matchup.game.startTimeET} ·{" "}
                {matchup.game.lineupsConfirmed ? "Lineups confirmed" : "Lineups projected"}
              </p>
              <p>
                Park: <b className="text-slate-200">{matchup.stadium.name}</b> — hit factor {matchup.stadium.hitFactor.toFixed(2)}, HR factor{" "}
                {matchup.stadium.hrFactor.toFixed(2)}
              </p>
              <p>
                Weather: <b className="text-slate-200">{matchup.weather.condition}</b>, {matchup.weather.tempF}°F, wind {matchup.weather.windMph} mph{" "}
                {matchup.weather.windDirection} ({matchup.weather.impact})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-850 p-3">
      <div className="text-base font-bold text-white">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
