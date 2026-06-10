# MLB Parleys Pick

MLB Parleys Pick is a dark-mode web app for generating three daily MLB parlays of 8-10 legs: Conservative, Balanced, and Aggressive.

Predictions are for informational purposes only. No model guarantees betting results.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database target: PostgreSQL
- Current data mode: mock mode by default
- Future integrations: MLB Stats API, Statcast/Baseball Savant, The Odds API, Weather API

## Run Locally

```bash
npm install
npm run dev
```

The client runs on `http://localhost:5173` and proxies API calls to the server on `http://localhost:5000`.

## Commands

```bash
npm run build
npm run test
npm run typecheck
```

## Project Structure

```text
client/                React + Tailwind UI
server/                Express API, scoring engine, mock data
server/src/scoring/    Probability engine and parlay generator
server/src/db/         PostgreSQL schema migration
```

## API

- `GET /api/mlb/games/today`
- `GET /api/mlb/odds/today`
- `POST /api/mlb/parlays/generate`
- `GET /api/mlb/parlays/today`
- `GET /api/mlb/picks/top`
- `GET /api/mlb/picks/top-2-hit-candidates`
- `GET /api/mlb/player/:id/matchup`
- `GET /api/mlb/stadium/:id/splits`
- `GET /api/mlb/settings`
- `POST /api/mlb/settings`

## Product Notes

- The generator never forces weak picks just to reach 10 legs.
- Parlays can use any mix of the allowed markets when the edge supports it.
- Correlation and repeat-player pressure are penalized in the scoring layer.
- Mock mode includes games, players, pitchers, odds, stadiums, weather, parlays, 2-hit candidates, and model performance.
