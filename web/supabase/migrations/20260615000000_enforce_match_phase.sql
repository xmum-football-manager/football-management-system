-- Harden matches.phase — the single source of truth for group vs knockout
-- classification (see web/lib/match-lifecycle.ts isGroupPhaseMatch /
-- isKnockoutPhaseMatch). The app was misclassifying matches by comparing team
-- group labels; a knockout match between two same-group teams was read as a
-- group match and locked the knockout tab. The code now trusts this column, so
-- guarantee at the DB level what it assumes: phase is always present and only
-- ever 'group' or 'knockout'. A NULL or typo phase can no longer be silently
-- misclassified (or disappear from both group and knockout views).
--
-- Note: generic fixture-add paths (addMatchAction / bulkAddMatchesAction) insert
-- without specifying phase and rely on the default below — those are group/
-- round-robin fixtures. Knockout bracket creation always sets phase explicitly.

-- Backfill any legacy NULLs (none expected) so SET NOT NULL succeeds.
update public.matches set phase = 'group' where phase is null;

-- Make the existing default explicit, and enforce presence + valid values.
alter table public.matches alter column phase set default 'group';
alter table public.matches alter column phase set not null;

alter table public.matches drop constraint if exists matches_phase_check;
alter table public.matches
  add constraint matches_phase_check check (phase in ('group', 'knockout'));
