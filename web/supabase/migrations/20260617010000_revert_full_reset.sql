-- Admin "Revert" (finished -> scheduled) told the user it would "restart the
-- match," but only flipped the status column. Score, kickoff/halftime/finish
-- timestamps, and goal/card rows all survived the revert, so kicking off
-- again resumed scoring on top of the old total instead of starting clean.
--
-- security definer so it can clear goals/cards despite their
-- "only while live" RLS delete policies — this is an explicit admin action,
-- not a live-scoring correction.
create or replace function public.revert_match_to_scheduled(p_match_id uuid)
returns void language plpgsql security definer as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can revert a match.';
  end if;

  delete from public.goals where match_id = p_match_id;
  delete from public.cards where match_id = p_match_id;

  update public.matches
    set status = 'scheduled',
        home_score = 0,
        away_score = 0,
        match_started_at = null,
        halftime_started_at = null,
        second_half_started_at = null,
        match_finished_at = null
    where id = p_match_id;
end;
$$;
