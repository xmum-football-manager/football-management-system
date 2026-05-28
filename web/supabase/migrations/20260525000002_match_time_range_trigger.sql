-- Enforce that match_time falls within the parent tournament's date range.
-- PostgreSQL does not support cross-table CHECK constraints, so we use a trigger.

CREATE OR REPLACE FUNCTION check_match_time_in_tournament_range()
RETURNS TRIGGER AS $$
DECLARE
  t_start date;
  t_end   date;
  match_day date;
BEGIN
  SELECT start_date, end_date
    INTO t_start, t_end
    FROM tournaments
   WHERE id = NEW.tournament_id;

  match_day := (NEW.match_time AT TIME ZONE 'UTC')::date;

  IF match_day < t_start OR match_day > t_end THEN
    RAISE EXCEPTION
      'Match time % is outside the tournament date range (% to %)',
      match_day, t_start, t_end;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_match_time_range
  BEFORE INSERT OR UPDATE OF match_time ON matches
  FOR EACH ROW
  EXECUTE FUNCTION check_match_time_in_tournament_range();
