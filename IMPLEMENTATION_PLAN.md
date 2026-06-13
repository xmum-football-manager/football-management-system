# GP→KO Tournament — LIVE HANDOFF (resume from here)

> Cold-start doc. Read this + `BUGS_GP_KO.txt` to resume. Updated 2026-06-13.
> Workflow used: orchestrated **sonnet coder (TDD) → sonnet reviewer → commit → (apply migration)**.

## Where things stand
- **Branch:** `fix/gp-ko-tournament-bugs` → **PR #58** (open, base `main`). Everything below is committed & pushed.
- **Suite:** 293 tests green, `tsc` clean. Test runner = vitest (pure-logic only; **no UI/component test harness** — TDD validators, manually verify UI).
- **Two DB migrations already APPLIED to remote production** (Supabase project `xqjmnxqceegrevlmbqbd`, linked): `20260613000000` (min-players), `20260613010000` (group-assignment). Both verified live.

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
- P0-2 & P0-1 CLOSED as non-issues (verified — see BUGS_GP_KO.txt).

## NEXT TASK — Reset Bracket feature (Option A, agreed with user)
**Problem:** `resetKnockoutAction` (fixtures/actions.ts) deletes ALL `phase='knockout'` matches with **no status guard**. Admin who sets up the first round wrong and **accidentally kicks off a KO match** is otherwise dead-ended (only escape = delete whole tournament). Need a safe reset.

**KEY FACT (why Option A, not "revert each round"):** `match-lifecycle.ts` has **no transition back to `scheduled`** (only `scheduled→live→{halftime,finished}`, admin `finished→live`). Reverting a played round would also need **un-advancement** (pull advanced teams out of downstream slots back to TBD) — a fragile cascade. Reset deletes the whole bracket anyway, so skip all that.

**Build (n-layer):**
1. **DB** — new migration `web/supabase/migrations/20260613020000_reset_knockout_bracket.sql`: function `reset_knockout_bracket(p_tournament_id uuid, p_force boolean) returns int` (SECURITY DEFINER). If `not p_force` AND any `phase='knockout'` match for the tournament has `status <> 'scheduled'` → `raise exception`. Else delete all knockout matches, return count. (Rule lives in DB; avoids a delete-trigger that would fight the force path.)
2. **Server** — `resetKnockoutAction(tournamentId, force=false)` calls the RPC via supabase `.rpc('reset_knockout_bracket', {...})`; surface error/count. (Replaces the current JS delete loop.)
3. **Pure logic (TDD)** — `canResetBracket(knockoutMatches: {status}[]): boolean` (true iff empty or all `scheduled`) in a sensible lib; used by client gray-out + as the normal-path check. Unit-test it.
4. **Client** — in `knockout/KnockoutStepper.tsx`: normal **Reset bracket** button **grayed/disabled** when `!canResetBracket`; a distinct **Force reset** behind a strong confirm dialog ("This deletes all N knockout matches incl. M in progress and all results. Qualifiers will unlock. Cannot be undone."). After reset, `bracketExists` flips false → qualifiers auto-unlock (existing behavior).
5. **Overview warning** — on the tournament overview page, when a KO match is live/finished, show why reset is locked ("Revert/clear the knockout results — use Force reset to wipe the bracket").
6. **Apply migration** after review (see procedure below). Honest caveat to keep in UI copy: force-reset is genuinely destructive (deletes played results) — safe path (grayed) must be the obvious default.

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
