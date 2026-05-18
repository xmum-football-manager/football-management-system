-- Add min_players_per_team to tournaments
ALTER TABLE tournaments
  ADD COLUMN min_players_per_team INTEGER NOT NULL DEFAULT 11
  CHECK (min_players_per_team >= 11);
