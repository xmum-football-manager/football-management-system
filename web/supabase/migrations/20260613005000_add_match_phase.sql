-- Add matches.phase — the group vs knockout classification column.
--
-- This column is referenced by later migrations (20260613010000 onward) and by
-- the application as the single source of truth for match phase, but no prior
-- migration ever created it (it had been added out-of-band on the original
-- database). This migration repairs that drift so the schema applies cleanly to
-- a fresh database. 20260615000000_enforce_match_phase.sql later hardens it
-- (default, NOT NULL, check constraint).
alter table public.matches
  add column if not exists phase text default 'group';
