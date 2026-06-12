# GP→KO Tournament — Bug-Fix Implementation Plan (LIVE HANDOFF)

> Source of truth for the agentic loop. Any session resumes from here.
> Loop per task: **sonnet coder (TDD) → sonnet reviewer → update this file → compact.**
> Companion: `BUGS_GP_KO.txt` (original findings + evidence).

## Health commands (run from `web/`)
- typecheck: `cd web && npx tsc --noEmit`
- lint: `cd web && pnpm lint`
- test: `cd web && npx vitest run`
- single test file: `cd web && npx vitest run __tests__/<file>.test.ts`

## Locked design decisions
- **P1-6:** Once any match is live → block group reassignment (already enforced). Pre-live but fixtures exist → allow reassign, but confirm-dialog warns "this deletes all fixtures + their scheduled times", then wipe fixtures so regenerate is unblocked.
- **P2-9:** KO draw winner-pick = KO-only, already works (no change). Group standings tie at the qualifying boundary → admin manually picks. Detection logic = `detectBoundaryTies` (DONE). Remaining = editable Qualifiers UI.
- **P2-10:** Reverting a finished KO match sets `winner_team_id = NULL`; re-finishing blocked until winner re-picked → trigger re-fans correct team.
- **P2-11:** Add "edit first-round pairing" (swap teams in a scheduled first-round KO match from the qualifier pool). No bracket-match deletion → no orphaned TBD.

## Task board
Status: TODO / DOING / REVIEW / DONE

| ID | Task | Status | Key files |
|----|------|--------|-----------|
| P1-7 | live-match guard on `addMatchAction` | DONE | web/app/admin/tournaments/[id]/fixtures/actions.ts |
| P2-9a | `detectBoundaryTies` pure logic + tests | DONE | web/lib/qualifiers.ts, web/__tests__/qualifiers.test.ts |
| P0-3 | status check on `addPlayerAction` | DONE | web/app/admin/tournaments/[id]/teams/actions.ts |
| P1-5 | block qualifiers until all group matches finished | DONE | web/app/admin/tournaments/[id]/fixtures/actions.ts (saveQualifiersAction); helper groupStageComplete in qualifiers.ts |
| P1-4 | seed-time bracket-size guard | DONE | fixtures/actions.ts (seedKnockoutBracketAction); helper expectedBracketSize in qualifiers.ts |
| P1-6 | warn+wipe fixtures on pre-live group reassign | TODO | teams/actions.ts (setTeamGroupAction), fixtures generate; UI confirm dialog |
| P2-9b | editable Qualifiers UI using `detectBoundaryTies` | TODO | web/app/admin/tournaments/[id]/knockout/QualifiersStep.tsx |
| P2-10 | clear winner on KO revert + force re-pick | DONE | match-lifecycle.ts (shouldClearKnockoutWinner), db/matches.ts (clearMatchWinner), admin actions.ts (transitionMatchAction) |
| P2-11 | edit first-round pairing (no delete) | TODO | knockout/BracketSetupView.tsx, fixtures/actions.ts |

## Acceptance criteria (TDD — write failing test first)
- **P0-3:** `addPlayerAction` rejects when tournament is finished/archived (`!canAddPlayers(status)`), mirroring `updatePlayerAction`. Test: action returns error for finished tournament. (Action-level test or extend lock-rules coverage.)
- **P1-5:** `saveQualifiersAction` rejects unless every `phase==='group'` match is `finished`; error names how many remain. Extract a pure helper `groupStageComplete(matches)` and unit-test it (no group matches → false; some scheduled/live → false; all finished → true).
- **P1-4:** Add pure helper `expectedBracketSize(knockout_start_round)` (final→2, semi→4, top_8→8, top_16→16, top_32→32) and have `seedKnockoutBracketAction` reject when `qualifiers.length !== expectedBracketSize`. Unit-test the helper + the mismatch guard.
- **P1-6:** Pure rule already exists (live check). New: `setTeamGroupAction` allowed pre-live even with fixtures; generate action replaces scheduled-only fixtures. UI confirm dialog warns before wipe. Test the "replace when all scheduled" branch.
- **P2-9b:** Wire `detectBoundaryTies` into QualifiersStep: contested teams become toggleable, enforce exactly `slots` picked among contested, exactly `advancePerGroup` per group total. Pure validator `validateQualifierSelection(standings, selectedIds, advancePerGroup, numGroups)` — TDD it.
- **P2-10:** Pure transition already in match-lifecycle. New: on KO `finished→live` revert, null the winner; finishing a level KO match blocked w/o winner (already true). Test the null-on-revert helper.
- **P2-11:** `updateFirstRoundPairingAction(matchId, homeId, awayId)` — only `scheduled` first-round KO match, both ids from qualifier pool, ids distinct. TDD a pure validator `validatePairingEdit(...)`.

## Subagent protocol (for the orchestrator)
1. **Coder (sonnet):** give it ONE task ID, the rows above, the health commands. It must: write failing test → run (RED) → minimal impl → run (GREEN) → typecheck. Return: files changed, test names, RED/GREEN evidence, anything surprising. Cap ~300 words.
2. **Reviewer (sonnet):** give it the `git diff` for that task only. Check correctness, scope creep, missed edge cases, that the test actually fails without the impl. Return verdict + must-fix list. Cap ~250 words.
3. Orchestrator applies must-fixes (or re-dispatches coder), flips status to DONE here, then compacts.

## RESUME HERE (3 remaining — all UI-heavy, TDD the pure validator then wire UI)
Done & reviewed: P1-7, P2-9a, P0-3, P1-5, P1-4, P2-10. Full suite green (257 tests), tsc clean. Nothing committed yet.
1. **P2-11** — `validatePairingEdit(match, homeId, awayId, qualifierIds)` pure validator (only `scheduled` first-round KO match; both ids in qualifier pool; ids distinct) → TDD it; then `updateFirstRoundPairingAction` + edit UI in BracketSetupView. Reuses `updateMatchTeams` (already in db/matches.ts).
2. **P2-9b** — `validateQualifierSelection(standings, selectedIds, advancePerGroup, numGroups)` pure validator (exactly advancePerGroup per group; contested picks within `detectBoundaryTies` set) → TDD; then make QualifiersStep toggleable, surface `detectBoundaryTies` groups. Save layer `updateKnockoutQualifiers` already accepts arbitrary lists.
3. **P1-6** — allow `setTeamGroupAction` pre-live even with fixtures; make `generateGroupFixturesAction` replace scheduled-only fixtures (TDD the replace branch); add confirm-dialog in TeamsPanel warning fixtures+times will be wiped.
Note: UI components have no unit-test harness here (vitest covers pure logic only) — TDD the validators, manually verify the UI wiring.

## Notes / gotchas
- P0-2 CLOSED (already safe: deletePlayerAction blocks once any match live).
- Save layer `updateKnockoutQualifiers(tournamentId, teamIds)` already accepts arbitrary lists — no DB change for P2-9b.
- KO winner-pick on draws already enforced at score/actions.ts:115 + admin/actions.ts:55.
- Don't auto-invoke superpowers skills (project CLAUDE.md) unless the user asks. TDD IS requested for this work.
