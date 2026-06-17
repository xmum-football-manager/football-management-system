-- Finished matches must have gone through the live transition, which always
-- sets match_started_at (see updateMatchStatus in lib/db/matches.ts). Use
-- NOT VALID: existing seeded test data has finished matches with no
-- match_started_at (seed scripts bypass the lifecycle on purpose), and we
-- must not break those rows. NOT VALID only enforces on new inserts/updates.
ALTER TABLE matches
  ADD CONSTRAINT matches_finished_requires_started
  CHECK (status <> 'finished' OR match_started_at IS NOT NULL) NOT VALID;
