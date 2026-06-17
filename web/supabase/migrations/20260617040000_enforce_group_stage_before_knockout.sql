-- A knockout match cannot kick off (status -> 'live') while any group-stage
-- match in the same tournament is unfinished. Group results feed knockout
-- seeding, so reverting a group result after the bracket is drawn must not
-- leave a knockout match playable on stale seeding. Enforced at the app layer
-- in both kickoff paths (transitionMatchAction + tokenTransitionMatch) via
-- groupStageComplete(); this trigger mirrors that invariant at the DB layer.
--
-- Scoped to the UPDATE into 'live' only: seed scripts INSERT match rows with
-- their status directly (bypassing the lifecycle on purpose), and this trigger
-- never fires on INSERT, so seeding is unaffected.

CREATE OR REPLACE FUNCTION enforce_group_stage_before_knockout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phase = 'knockout'
     AND NEW.status = 'live'
     AND OLD.status IS DISTINCT FROM 'live'
     AND EXISTS (
       SELECT 1 FROM matches g
       WHERE g.tournament_id = NEW.tournament_id
         AND g.phase = 'group'
         AND g.status <> 'finished'
     )
  THEN
    RAISE EXCEPTION 'All group-stage matches must be finished before knockout play can begin.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_group_stage_before_knockout
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION enforce_group_stage_before_knockout();
