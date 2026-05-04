-- Add 'halftime' to matches.status CHECK constraint
-- matches.status was: check (status in ('scheduled', 'live', 'finished'))
-- New:               check (status in ('scheduled', 'live', 'halftime', 'finished'))

alter table public.matches
  drop constraint if exists matches_status_check;

alter table public.matches
  add constraint matches_status_check
  check (status in ('scheduled', 'live', 'halftime', 'finished'));
