-- Fix: deleting a tournament failed once any admin action was logged.
--
-- admin_audit_log.tournament_id and .match_id referenced tournaments/matches
-- with NO ACTION (no cascade), and admin_audit_log is never itself
-- cascade-deleted. So any tournament with audit entries (e.g. from a match
-- revert) could not be deleted — the FK on admin_audit_log blocked it.
-- Cascade the audit rows when their tournament/match is removed.

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_tournament_id_fkey,
  add constraint admin_audit_log_tournament_id_fkey
    foreign key (tournament_id) references public.tournaments(id) on delete cascade;

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_match_id_fkey,
  add constraint admin_audit_log_match_id_fkey
    foreign key (match_id) references public.matches(id) on delete cascade;
