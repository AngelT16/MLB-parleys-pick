# MLB Parleys Pick

Professional MLB parlay generator. Builds three daily parlays (8–10 legs) from data-driven picks using probability, edge, batter-vs-pitcher history, recent form, stadium splits, weather, lineups and probable pitchers.

> **Disclaimer:** Predictions are for informational purposes only. No model guarantees betting results.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS (premium dark UI)
- **Backend:** Express + TypeScript (Node 20, ESM) + Zod validation
- **Mock mode:** works fully offline with realistic generated data — no API keys needed
- **Ready for later:** PostgreSQL (`DATABASE_URL`), real odds (`ODDS_API_KEY`) and weather (`WEATHER_API_KEY`) providers

## Install

```bash
npm install
```

The root `postinstall` also installs `client/` and `server/` dependencies. If you need to do it manually:

```bash
npm install --prefix client
npm install --prefix server
```

## Run locally

```bash
npm run dev
```

- Client: http://localhost:5173 (Vite, proxies `/api` to the server)
- Server: http://localhost:5000

Build and test:

```bash
npm run build
npm run test
```

## Run on Replit

1. Import the repo into Replit.
2. Hit **Run** — `.replit` runs `npm run dev`, which starts both the API (port 5000) and the Vite client (port 5173, exposed as the preview).
3. The preview works on `*.replit.dev` / `*.spock.replit.dev` hosts because `client/vite.config.ts` sets:

```ts
server: {
  host: "0.0.0.0",
  port: 5173,
  strictPort: true,
  allowedHosts: true, // fixes "Blocked request. This host ... is not allowed."
  proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } },
}
```

If your Vite version rejects `allowedHosts: true`, use an explicit list instead:

```ts
allowedHosts: [".replit.dev", ".replit.app", ".spock.replit.dev", "localhost", "127.0.0.1"]
```

## Mock mode

`MOCK_MODE=true` (default). The server generates a realistic, deterministic slate per day: 6 games, lineups, probable pitchers, odds, stadium factors, weather, tracked results and model performance. No external API calls are made. Set `MOCK_MODE=false` only once real providers are wired in.

## Connecting real APIs later

1. Copy `.env.example` to `.env` and fill in `ODDS_API_KEY`, `WEATHER_API_KEY`, `DATABASE_URL`.
2. Replace `server/src/mockData.ts` consumers in `server/src/routes.ts` with real fetchers (games/lineups from MLB Stats API, odds from your odds provider, weather from your weather provider).
3. Swap the in-memory settings/results state in `routes.ts` for PostgreSQL.

The scoring engine and parlay generator are provider-agnostic: they only consume the typed `Game`/`Batter`/`Pitcher` shapes in `server/src/types.ts`.

## Scoring engine

All scoring lives in `server/src/scoring/`:

- `odds.ts` — `americanOddsToImpliedProbability`, decimal conversions, `calculateEdge`, `getConfidenceLabel` (Elite ≥ 80, Strong ≥ 68, Playable ≥ 55, else Avoid).
- `scoringEngine.ts` — one scorer per market:
  - **Hits:** recent form (L5/L10/L15), season AVG, xBA, contact/K rate, batter-vs-pitcher, pitcher AVG allowed, park hit factor, weather, lineup status.
  - **2+ total bases:** xSLG, ISO, hard-hit %, barrel %, park HR factor, pitcher SLG allowed, recent total bases, wind.
  - **Pitcher Ks:** pitcher K%, opponent K%, projected innings, last-3-start K form, whiff rate, pitch count.
  - **Moneyline:** starting-pitcher edge, bullpen ERA, offense last 7/14 days, home/away, rest, market edge.
  - **Totals (full game & first 5):** offense form, starter ERAs, park run factor, weather/wind.
- `correlation.ts` — `applyCorrelationPenalty`: blocks duplicate subjects and bad correlations (game Under vs batter props, K Over vs opposing hitters), penalizes correlated stacks, allows positive correlation only while the leg still grades Playable+.
- `parlayGenerator.ts` — `generateParlays` builds **Conservative** (highest probability), **Balanced** (probability + payout) and **Aggressive** (higher odds, still positive edge). Markets are never forced; it never pads with bad picks just to reach 10 legs, and it respects max picks per game.

## API

```
GET  /api/health
GET  /api/mlb/games/today
GET  /api/mlb/odds/today
POST /api/mlb/parlays/generate
GET  /api/mlb/parlays/today
GET  /api/mlb/picks/top
GET  /api/mlb/picks/top-2-hit-candidates
GET  /api/mlb/player/:id/matchup
GET  /api/mlb/stadium/:id/splits
GET  /api/mlb/settings
POST /api/mlb/settings
GET  /api/mlb/results/tracker
GET  /api/mlb/model/performance
```

## Project structure

```
client/   React + Vite + Tailwind UI (pages, components, api client, types)
server/   Express API, mock data, scoring engine, tests (vitest)
```
