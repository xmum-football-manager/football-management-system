-- Allow knockout_round = 'third' for the third-place playoff.
--
-- Some environments acquired a `matches_knockout_round_check` constraint
-- out-of-band that only permits ('r32','r16','qf','sf','final'), so inserting
-- the third-place match fails with "violates check constraint
-- matches_knockout_round_check". Drop any such constraint and recreate it to
-- include 'third' (null remains allowed for group matches).

alter table public.matches
  drop constraint if exists matches_knockout_round_check;

alter table public.matches
  add constraint matches_knockout_round_check
  check (knockout_round is null or knockout_round in ('r32','r16','qf','sf','final','third'));
