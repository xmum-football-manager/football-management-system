-- Safe knockout bracket reset function.
--
-- Deletes all phase='knockout' matches for a tournament.
-- With p_force = false (normal path): raises an exception if any knockout
-- match is not in 'scheduled' status (i.e. is live or finished).
-- With p_force = true (escape hatch): skips the guard and deletes everything.
--
-- Returns the number of rows deleted.

create or replace function public.reset_knockout_bracket(
  p_tournament_id uuid,
  p_force         boolean
) returns int
language plpgsql security definer as $$
declare
  v_deleted int;
begin
  -- Guard: refuse normal reset if any KO match has already started.
  if not p_force then
    if exists (
      select 1
        from public.matches
       where tournament_id = p_tournament_id
         and phase = 'knockout'
         and status <> 'scheduled'
    ) then
      raise exception 'knockout matches are already underway — use force reset to wipe the bracket';
    end if;
  end if;

  delete from public.matches
   where tournament_id = p_tournament_id
     and phase = 'knockout';

  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke execute on function public.reset_knockout_bracket(uuid, boolean) from public, anon, authenticated;
