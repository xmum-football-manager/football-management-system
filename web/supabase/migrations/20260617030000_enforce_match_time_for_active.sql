-- A match can only go live (and therefore reach halftime/finished) once it
-- has a scheduled match_time — enforced today at the app layer in
-- transitionMatchAction (the "schedule all matches in this phase first"
-- guard). Mirror that invariant at the DB layer. NOT VALID: existing seeded
-- test data may have finished matches with no match_time (seed scripts
-- bypass the lifecycle on purpose), so only new inserts/updates are checked.
ALTER TABLE matches
  ADD CONSTRAINT matches_active_requires_match_time
  CHECK (status = 'scheduled' OR match_time IS NOT NULL) NOT VALID;
