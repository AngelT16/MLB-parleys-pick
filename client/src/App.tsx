import {
  BarChart3,
  Clipboard,
  CloudSun,
  Gauge,
  Home,
  LineChart,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateParlays, loadDashboardData } from "./api";
import type { Game, Parlay, Pick, TwoHitCandidate } from "./types";

const nav = [
  ["Dashboard", Home],
  ["Generated Parlays", Sparkles],
  ["Top Picks", Target],
  ["Top 2-Hit Candidates", Trophy],
  ["Matchup Analyzer", Gauge],
  ["Stadium Splits", BarChart3],
  ["Results Tracker", LineChart],
  ["Settings", Settings]
] as const;

const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`;
const fmtEdge = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const fmtOdds = (value: number) => (value > 0 ? `+${value}` : `${value}`);

function Badge({ label }: { label: string }) {
  const styles: Record<string, string> = {
    Elite: "bg-accent/15 text-accent ring-accent/30",
    Strong: "bg-gold/15 text-gold ring-gold/30",
    Playable: "bg-sky-400/15 text-sky-300 ring-sky-300/30",
    "Avoid / No Bet": "bg-danger/15 text-danger ring-danger/30"
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[label] ?? styles.Playable}`}>
      {label}
    </span>
  );
}

function MetricCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof Home }) {
  return (
    <section className="rounded-lg border border-line bg-panel/88 p-4 shadow-glow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{value}</h3>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="rounded-lg bg-accent/10 p-2 text-accent">
          <Icon size={20} />
        </div>
      </div>
    </section>
  );
}

function GamesTable({ games }: { games: Game[] }) {
  return (
    <section className="rounded-lg border border-line bg-panel/88 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Today's Games Overview</h2>
        <span className="text-xs text-slate-400">Mock MLB slate</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="pb-3">Game</th>
              <th className="pb-3">Time</th>
              <th className="pb-3">Pitchers</th>
              <th className="pb-3">Venue</th>
              <th className="pb-3">Weather</th>
              <th className="pb-3">Lineups</th>
              <th className="pb-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {games.map((game) => (
              <tr key={game.id}>
                <td className="py-3 font-medium text-white">{game.awayTeam} @ {game.homeTeam}</td>
                <td className="py-3 text-slate-300">{game.startTime}</td>
                <td className="py-3 text-slate-300">{game.probablePitchers.away} / {game.probablePitchers.home}</td>
                <td className="py-3 text-slate-300">{game.venue}</td>
                <td className="py-3 text-slate-300">{game.weather.temp}F, {game.weather.impact}</td>
                <td className="py-3">{game.lineupsConfirmed ? <Badge label="Strong" /> : <Badge label="Playable" />}</td>
                <td className="py-3 text-slate-300">{game.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PickLine({ pick }: { pick: Pick }) {
  return (
    <div className="rounded-lg border border-line/80 bg-ink/55 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{pick.market}</p>
          <h4 className="mt-1 font-semibold text-white">{pick.selection}</h4>
          <p className="text-sm text-slate-400">{pick.game}</p>
        </div>
        <Badge label={pick.confidenceLabel} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-slate-400">
        <span>Odds <b className="text-white">{fmtOdds(pick.odds)}</b></span>
        <span>Model <b className="text-white">{fmtPct(pick.modelProbability)}</b></span>
        <span>Edge <b className="text-accent">{fmtEdge(pick.edge)}</b></span>
        <span>Score <b className="text-white">{pick.confidenceScore}</b></span>
      </div>
      <p className="mt-3 text-sm text-slate-300">{pick.reason}</p>
    </div>
  );
}

function ParlayCard({ parlay }: { parlay: Parlay }) {
  const copyText = `${parlay.name}\n${parlay.legs.map((leg, index) => `${index + 1}. ${leg.selection} (${leg.market}) ${fmtOdds(leg.odds)}`).join("\n")}`;

  return (
    <section className="rounded-lg border border-line bg-panel/88 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-accent">{parlay.profile}</p>
          <h3 className="mt-1 text-xl font-bold text-white">{parlay.name}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {parlay.legs.length} legs, {fmtOdds(parlay.combinedOdds)} combined, {parlay.riskRating} risk
          </p>
        </div>
        <button
          className="rounded-lg border border-line bg-panel2 px-3 py-2 text-sm text-slate-200 hover:border-accent hover:text-accent"
          onClick={() => navigator.clipboard?.writeText(copyText)}
        >
          Copy Parlay
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {parlay.legs.map((leg) => <PickLine key={leg.id} pick={leg} />)}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
        <span className="text-slate-400">Est. hit <b className="block text-white">{fmtPct(parlay.estimatedProbability)}</b></span>
        <span className="text-slate-400">Edge <b className="block text-accent">{fmtEdge(parlay.projectedEdge)}</b></span>
        <span className="text-slate-400">Correlation <b className="block text-white">Penalized</b></span>
      </div>
    </section>
  );
}

function RightPanel({ candidates, picks }: { candidates: TwoHitCandidate[]; picks: Pick[] }) {
  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-line bg-panel/88 p-4">
        <h3 className="font-semibold text-white">Top 2-Hit Candidates</h3>
        <div className="mt-3 space-y-3">
          {candidates.slice(0, 4).map((candidate) => (
            <div key={candidate.player} className="rounded-lg bg-ink/55 p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{candidate.player}</p>
                  <p className="text-xs text-slate-400">{candidate.team} vs {candidate.opponent}</p>
                </div>
                <Badge label={candidate.confidence} />
              </div>
              <p className="mt-2 text-sm text-slate-300">{fmtPct(candidate.estimatedProbability)} probability, {fmtEdge(candidate.edge)} edge</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-line bg-panel/88 p-4">
        <h3 className="font-semibold text-white">Best Picks Today</h3>
        <div className="mt-3 space-y-3">
          {picks.slice(0, 5).map((pick) => (
            <div key={pick.id} className="flex items-center justify-between gap-3 rounded-lg bg-ink/55 p-3">
              <div>
                <p className="text-sm font-semibold text-white">{pick.selection}</p>
                <p className="text-xs text-slate-400">{pick.market}</p>
              </div>
              <span className="text-sm font-bold text-accent">{fmtEdge(pick.edge)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-line bg-panel/88 p-4">
        <h3 className="font-semibold text-white">Model Performance</h3>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-ink/55 p-3"><p className="text-xl font-bold text-white">58.7%</p><p className="text-xs text-slate-400">Win rate</p></div>
          <div className="rounded-lg bg-ink/55 p-3"><p className="text-xl font-bold text-accent">+7.4%</p><p className="text-xs text-slate-400">ROI</p></div>
          <div className="rounded-lg bg-ink/55 p-3"><p className="text-xl font-bold text-gold">+3.1%</p><p className="text-xs text-slate-400">CLV</p></div>
        </div>
      </section>
    </aside>
  );
}

export default function App() {
  const [games, setGames] = useState<Game[]>([]);
  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [topPicks, setTopPicks] = useState<Pick[]>([]);
  const [twoHitCandidates, setTwoHitCandidates] = useState<TwoHitCandidate[]>([]);
  const [lastModelUpdate, setLastModelUpdate] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const data = await loadDashboardData();
    setGames(data.games);
    setParlays(data.parlays);
    setTopPicks(data.topPicks);
    setTwoHitCandidates(data.twoHitCandidates);
    setLastModelUpdate(data.settings.lastModelUpdate);
    setLoading(false);
  }

  async function regenerate() {
    setParlays(await generateParlays());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const topEdge = useMemo(() => topPicks[0]?.edge ?? 0, [topPicks]);
  const confirmed = games.filter((game) => game.lineupsConfirmed).length;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-ink/92 p-4 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-accent p-2 text-ink"><ShieldCheck size={24} /></div>
          <div>
            <h1 className="text-lg font-black text-white">MLB Parleys Pick</h1>
            <p className="text-xs text-slate-400">Daily model edge desk</p>
          </div>
        </div>
        <nav className="mt-8 grid gap-1">
          {nav.map(([label, Icon], index) => (
            <a key={label} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${index === 0 ? "bg-accent/12 text-accent" : "text-slate-300 hover:bg-panel2"}`} href="#">
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <p className="mt-8 rounded-lg border border-line bg-panel p-3 text-xs leading-5 text-slate-400">
          Predictions are for informational purposes only. No model guarantees betting results.
        </p>
      </aside>

      <main className="p-4 lg:p-6">
        <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-sm text-slate-400">Wednesday, June 10, 2026</p>
            <h2 className="text-3xl font-black text-white">Dashboard</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel2 px-4 py-2 text-sm text-white hover:border-accent" onClick={refresh}>
              <RefreshCw size={16} /> Refresh Data
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-bold text-ink hover:bg-accent/90" onClick={regenerate}>
              <Clipboard size={16} /> Generate New Parlays
            </button>
          </div>
        </header>

        {loading ? (
          <div className="rounded-lg border border-line bg-panel p-10 text-center text-slate-300">Loading MLB model workspace...</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard title="Games Today" value={`${games.length}`} detail="Projected MLB slate" icon={Home} />
                <MetricCard title="Lineups Confirmed" value={`${confirmed}/${games.length}`} detail="Updated from mock feed" icon={ShieldCheck} />
                <MetricCard title="Top Edge Today" value={fmtEdge(topEdge)} detail={topPicks[0]?.selection ?? "No pick"} icon={Target} />
                <MetricCard title="Last Model Update" value={lastModelUpdate} detail="Mock mode active" icon={RefreshCw} />
                <MetricCard title="Weather Impact" value="Moderate" detail="Wind and park factors applied" icon={CloudSun} />
              </div>

              <GamesTable games={games} />

              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Generated Parlays</h2>
                  <span className="text-sm text-slate-400">8-10 legs only when quality supports it</span>
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  {parlays.map((parlay) => <ParlayCard key={parlay.id} parlay={parlay} />)}
                </div>
              </section>
            </div>
            <RightPanel candidates={twoHitCandidates} picks={topPicks} />
          </div>
        )}
      </main>
    </div>
  );
}
