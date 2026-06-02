-- Knockout bracket advancement: feeder-match edges + nullable team slots.
--
-- SCHEMA DRIFT: columns `phase` and `knockout_round` already exist on the
-- remote DB but were never captured in a repo migration. They are intentionally
-- NOT re-declared here to avoid "column already exists" failures. This migration
-- is focused only on the new advancement columns.

-- A bracket slot is empty until its feeder match resolves, so team ids are now nullable.
ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;

-- Explicit feeder edges: this match's home/away slot = winner of the referenced match.
ALTER TABLE matches ADD COLUMN home_source_match_id uuid REFERENCES matches(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN away_source_match_id uuid REFERENCES matches(id) ON DELETE SET NULL;

-- Who advances from this match: auto from score, admin-set on a draw.
ALTER TABLE matches ADD COLUMN winner_team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
