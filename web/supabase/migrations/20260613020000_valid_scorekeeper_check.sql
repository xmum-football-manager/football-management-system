-- Pre-flight: verify no existing rows violate the new constraint
-- (both null or both set for scorekeeper rows)
-- SELECT * FROM public.user_roles
--   WHERE role = 'scorekeeper'
--     AND (
--       (tournament_id IS NULL AND match_id IS NULL)
--       OR (tournament_id IS NOT NULL AND match_id IS NOT NULL)
--     );

alter table public.user_roles add constraint valid_scorekeeper check (
  role <> 'scorekeeper'
  or (tournament_id is not null and match_id is null)   -- tournament-wide
  or (tournament_id is null and match_id is not null)   -- single match
);
