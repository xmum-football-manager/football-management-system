-- Add matches.knockout_round — the bracket-round label for knockout-phase
-- matches ('r32','r16','qf','sf','final'); null for group matches.
--
-- This column is referenced throughout the app (lib/db/matches.ts, the fixtures
-- actions, lib/home-utils.ts) and the Match type (knockout_round: string | null),
-- but no migration ever created it — existing environments acquired it
-- out-of-band, so any database built purely from this migrations directory
-- (e.g. the prod project) was missing it and rejected knockout match inserts
-- with "Could not find the 'knockout_round' column".
--
-- Nullable text, no check constraint — matching the documented type
-- (string | null) and the prior undocumented column behaviour.

alter table public.matches
  add column if not exists knockout_round text;
