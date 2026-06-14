# GP→KO Tournament — LIVE HANDOFF (resume from here)

> Cold-start doc. Read this + `BUGS_GP_KO.txt` to resume. Updated 2026-06-13.
> Workflow used: orchestrated **sonnet coder (TDD) → sonnet reviewer → commit → (apply migration)**.

## Where things stand
- **Branch:** `fix/gp-ko-tournament-bugs` → **PR #58** (open, base `main`). Everything below is committed & pushed.
- **Suite:** 293 tests green, `tsc` clean. Test runner = vitest (pure-logic only; **no UI/component test harness** — TDD validators, manually verify UI).
- **Three DB migrations APPLIED to remote production** (Supabase project `xqjmnxqceegrevlmbqbd`, linked): `20260613000000` (min-players), `20260613010000` (group-assignment), `20260613030000` (reset_knockout_bracket). All verified live. (`20260613020000` = user's scorekeeper migration, also on remote.)

## Health commands (run from `web/`)
- test: `cd web && npx vitest run`  · typecheck: `cd web && npx tsc --noEmit`  · lint: `cd web && pnpm lint`

## DONE (all TDD'd + sonnet-reviewed, on PR #58)
| ID | Fix | Pure helper |
|----|-----|-------------|
| P0-3 | `addPlayerAction` blocks finished/archived | (canAddPlayers) |
| P1-4 | seed rejects qualifier count ≠ bracket size | `expectedBracketSize` |
| P1-5 | qualifiers blocked until group stage done | `groupStageComplete` |
| P1-6 | group reassign unstuck; replaces group-only fixtures + confirm dialog | `canRegenerateFixtures` |
| P1-7 | `addMatchAction` live-match guard | — |
| P2-9 | editable qualifiers + group tie-break toggles | `detectBoundaryTies`, `validateQualifierSelection`, `_groupBoundary` |
| P2-10 | KO revert clears `winner_team_id` (no stale advance) | `shouldClearKnockoutWinner` |
| P2-11 | edit first-round pairing + cross-match dup guard | `validatePairingEdit` (`occupiedByOthers`) |
| toast-z | sonner Toaster z-100 so validation toasts show above dialogs | — |
| min-players | **3-level hard gate** (lib/min-players.ts + 7 server gates + DB trigger `enforce_min_players_on_match`) | `teamsShortOfMinPlayers` |
| groups-complete | **3-level hard gate** (lib/groups-complete.ts + generateGroupFixtures gate + DB trigger `enforce_group_assignment_on_match`) | `groupCompleteness` |
| reset-bracket | guarded reset + **Force reset** escape; DB fn `reset_knockout_bracket(tournament_id, force)` (EXECUTE revoked from public/anon/authenticated; server calls via service-role client behind `ensureOrganizer`); KnockoutStepper gray-out + force dialog. Verified live (anon denied, non-force blocks while live, force wipes). | `canResetBracket` |
- P0-2 & P0-1 CLOSED as non-issues (verified — see BUGS_GP_KO.txt).

## NEXT TASK — none queued. Pick from "Open items" below.
Optional polish from the reset feature: the spec also called for an **overview-page banner** when a KO match is live/finished, explaining why reset is locked. The gray-out + Force-reset dialog shipped in `KnockoutStepper.tsx`, but a banner on the tournament overview page (`app/admin/tournaments/[id]/page.tsx`) was NOT added. Add if wanted.

## Open items (user's call, not started)
- **Qualifier-lock timing** (declined option b): qualifiers currently editable until *Create Bracket*, then lock (`canEditQualifiers = … && !bracketExists`). User may later want lock-on-confirm.
- **Dependabot:** 32 vulns on default branch (16 high). Offered `pnpm audit` triage — not done.
- **Cleanup:** disposable QA tournaments still in remote DB: `QA · MP Under/Exact/Empty` (and re-running seeds wipes them). Delete when user says.

## How to apply a migration to remote (procedure, verified working)
From `web/`: read `SUPABASE_DB_PASSWORD` from `.env.local`; `supabase db push --dry-run --password "$PW"` (confirm only the new file is pending); then `echo y | supabase db push --password "$PW"`. The `NOTICE ... trigger does not exist, skipping` is just `drop trigger if exists` — harmless. Verify live with a throwaway tsx script using the service-role key, then delete it.

## Facts / gotchas
- **Browser QA:** dev server runs on `localhost:3000`; admin login `admin@admin.org` (pwd in `.env.local` `TEST_USER_PASSWORD`). gstack `browse` daemon session **expires between sessions** — re-login (snapshot the login form for fresh @refs: Email/Password/Sign in). App points at REMOTE Supabase (no local instance).
- **`players` table columns:** `team_id, name, jersey_number` ONLY — **no `position` column** (old seed scripts had a stale `position` line that crashes).
- **Seed scripts:** `scripts/seed-qa-minplayers.ts` (min-players edges), `scripts/seed-qa-states.ts` (the 3 UI-flow states). Run: `set -a && . ./.env.local && set +a && npx tsx scripts/<f>.ts` from `web/`.
- **Match phases:** `phase ∈ {'group','knockout'}`. Knockout TBD slots = null `home_team_id`/`away_team_id` with `home_source_match_id`/`away_source_match_id` set. First-round KO match = both source ids null.
- **Don't auto-invoke superpowers skills** (project CLAUDE.md) unless user asks. TDD IS wanted for this work.
- Subagent protocol: coder gets ONE task + RED/GREEN requirement; reviewer gets the **exact diff hunks** (not `git diff` vs HEAD — pre-existing WIP shows as false scope-creep). Commit each task so the next reviewer's `git diff` is clean.
