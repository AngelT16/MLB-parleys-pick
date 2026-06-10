CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mlb_team_id TEXT UNIQUE,
  abbreviation TEXT NOT NULL,
  name TEXT NOT NULL,
  league TEXT,
  division TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stadiums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mlb_stadium_id TEXT UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  park_factor NUMERIC(6, 3) NOT NULL DEFAULT 1,
  hit_factor NUMERIC(6, 3) NOT NULL DEFAULT 1,
  home_run_factor NUMERIC(6, 3) NOT NULL DEFAULT 1,
  weather_sensitivity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mlb_player_id TEXT UNIQUE,
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  bats TEXT,
  throws TEXT,
  primary_position TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pitchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  pitch_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  handedness TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mlb_game_pk TEXT UNIQUE,
  game_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  away_team_id UUID REFERENCES teams(id),
  home_team_id UUID REFERENCES teams(id),
  stadium_id UUID REFERENCES stadiums(id),
  away_pitcher_id UUID REFERENCES pitchers(id),
  home_pitcher_id UUID REFERENCES pitchers(id),
  lineups_confirmed BOOLEAN NOT NULL DEFAULT false,
  weather JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE odds_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  sportsbook TEXT NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds INTEGER NOT NULL,
  implied_probability NUMERIC(7, 4) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  game_id UUID REFERENCES games(id),
  hits INTEGER NOT NULL DEFAULT 0,
  total_bases INTEGER NOT NULL DEFAULT 0,
  at_bats INTEGER NOT NULL DEFAULT 0,
  walks INTEGER NOT NULL DEFAULT 0,
  strikeouts INTEGER NOT NULL DEFAULT 0,
  batted_ball_profile JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE pitcher_game_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pitcher_id UUID REFERENCES pitchers(id),
  game_id UUID REFERENCES games(id),
  innings_pitched NUMERIC(4, 1) NOT NULL DEFAULT 0,
  strikeouts INTEGER NOT NULL DEFAULT 0,
  walks INTEGER NOT NULL DEFAULT 0,
  earned_runs INTEGER NOT NULL DEFAULT 0,
  pitch_usage JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE model_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id),
  player_id UUID REFERENCES players(id),
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds INTEGER NOT NULL,
  implied_probability NUMERIC(7, 4) NOT NULL,
  model_probability NUMERIC(7, 4) NOT NULL,
  edge NUMERIC(7, 4) NOT NULL,
  confidence_score INTEGER NOT NULL,
  confidence_label TEXT NOT NULL,
  reason TEXT NOT NULL,
  data_points_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE generated_parlays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile TEXT NOT NULL,
  name TEXT NOT NULL,
  estimated_probability NUMERIC(8, 5) NOT NULL,
  combined_odds INTEGER NOT NULL,
  projected_edge NUMERIC(7, 4) NOT NULL,
  risk_rating TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE generated_parlay_legs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parlay_id UUID REFERENCES generated_parlays(id) ON DELETE CASCADE,
  prediction_id UUID REFERENCES model_predictions(id),
  leg_order INTEGER NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  odds INTEGER NOT NULL
);

CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE results_tracker (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id UUID REFERENCES model_predictions(id),
  parlay_id UUID REFERENCES generated_parlays(id),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Won', 'Lost', 'Void')),
  closing_odds INTEGER,
  clv NUMERIC(7, 4),
  stake NUMERIC(10, 2) NOT NULL DEFAULT 1,
  payout NUMERIC(10, 2),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_date ON games(game_date);
CREATE INDEX idx_predictions_market ON model_predictions(market);
CREATE INDEX idx_results_status ON results_tracker(status);
