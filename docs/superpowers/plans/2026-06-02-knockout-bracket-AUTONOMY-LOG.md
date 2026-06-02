# Knockout Bracket — Autonomy Session Log (2026-06-02)

Working autonomously while the user is away (~30 min). This log captures **what I did**, **every assumption I made** (for the user to confirm/reject), and **questions deferred** for when they return.

---

## Verified facts (not assumptions)
- DB probe (subagent `ko-diag`): tournament "KO Test Runners" (`a7c5d168-a368-43d5-be27-c0da50d11e02`) has exactly **2 knockout matches**, both `phase='knockout'`, `knockout_round='sf'`, `status='finished'`, with Jan-2026 match_times. No `final` match. **The data is correct** — not a missing-phase or failed-insert bug.
- RLS SELECT on `matches` is `using(true)`; both `listMatches`/`listMatchesAdmin` use `select('*')`. Not a visibility bug.
- `createManualKnockoutAction` sets `phase:'knockout'` + `knockout_round`, and revalidates overview/ko/public paths correctly.
- Seed script (`seed-knockout-test.ts`) creates ONLY group matches — never KO. So it's irrelevant to the missing-bracket symptom.
- Both bracket renderers infer rounds by **array-position / match-count**, ignoring the authoritative `knockout_round` column (`AdminBracketView.bucketRounds:50`, public `BracketView:112-114`). This is a real fragility even though static tracing says the current 2-SF case *should* still render.
- `phase` / `knockout_round` columns are NOT in any repo migration (only on remote DB) — **schema drift**.

## Decisions / Assumptions made while autonomous
> User: please confirm or correct each when you return.

- **A1 —** I treat the user's goal as: "created KO matches must reliably show in the admin Structure tab AND the public bracket." I am implementing the `groupByKnockoutRound` fix (plan Tasks 2–4) as the robustness fix regardless of whether the current 2-SF case happens to render, because keying on the real column is the correct single-source-of-truth design and directly serves the sync goal.
- (more appended below as they arise)

## Deferred questions (answer on return)
- (appended below as they arise)

## EMPIRICAL FINDING (browser, headless chromium against live dev server)
Drove `http://localhost:3000/t/a7c5d168-...` and clicked the Bracket tab. The public `#bracket` rendered correctly:
- SEMIFINALS: Team Alpha 0 – Team Beta 0 (finished 0–0 draw); Team Epsilon 1 – Team Zeta 0 (Epsilon won)
- FINAL: TBD vs TBD; CHAMPION: TBD
- **Zero console errors.** Screenshot at `/tmp/ko-bracket-public.png`.

**Conclusion: the public bracket sync is NOT broken on current data — it works.** The Final is correctly TBD because one SF was a 0–0 draw (no winner to advance; auto-advance correctly skipped it).

**So the "missing bracket" symptom is NOT reproducible (public side).** Most likely original causes: (a) stale data from before the recent `knockout_round` lowercase/CHECK-constraint fix commits; (b) admin-side `usePersistedView` localStorage holding `'board'`/`'list'`, so the Structure tab (with the bracket) wasn't shown. Admin side not browser-verified (needs auth) but static trace says it renders the same 2-SF + TBD-Final layout.

## DECISION under autonomy (A2)
Despite the feature working empirically, I am proceeding with the **groupByKnockoutRound robustness fix** (plan Tasks 2–4) because:
1. It's the user's explicitly stated root-cause theme — "code uses fragile heuristic instead of the authoritative column." The count-slice bucketing (`BracketView:112`, `AdminBracketView.bucketRounds:50`) ignores the real `knockout_round` column. Same anti-pattern family as the phase heuristic.
2. It's low-risk, TDD'd, and removes a class of latent mis-bucketing bugs (when match_time ordering ≠ round order, or counts collide across partial rounds).
3. It directly serves the sync goal.
**If the user prefers surgical "don't touch working code," this is reversible — it's uncommitted working-tree changes.**

### Assumption A3 — workflow
Original plan was "subagent implements, I review." A safety-classifier outage is intermittently blocking subagent write/network ops. Since I have autonomy and the changes are mechanical+well-specified, I'm implementing directly with full self-verification (TDD + tsc + lint + test + browser regression check) instead of risking blocked subagents.

### Assumption A4 — no commits
Harness rule: commit only when the user asks. User did not ask. Leaving all changes as uncommitted working-tree edits on `main` for review via `git diff`. NOT committing.

## Deferred questions (answer on return)
- Q1: Was the bracket *actually* missing for you recently, or was it stale data / wrong admin sub-view? If it genuinely rendered empty with KO matches present, I need a repro (which tournament, which surface, screenshot).
- Q2: Do you want the admin `usePersistedView` to auto-snap to the Structure tab when knockout matches first appear? (Currently it honors whatever you last selected.) This is the most likely admin-side "missing" cause.
- Q3: Keep the groupByKnockoutRound robustness fix, or revert it since the feature already works?

## IMPLEMENTED (TDD, all verified)
New file `lib/bracket.ts` (single source of truth for bracket round structure), with `__tests__/bracket.test.ts` — **13 tests, all written test-first (red→green)**:
- `groupByKnockoutRound(matches)` — groups by the authoritative `knockout_round` column, ordered r32→final, drops null/unknown.
- `futureRoundsAfter(lastRound, lastCount)` — TBD future-round preview (halving down to final).
- `countStrayKnockoutMatches(matches)` — count of matches with null/unknown round.
- `knockoutRoundLabel(round)` / `KNOCKOUT_ROUND_ORDER`.

Rewired both renderers to use it (removed count-slice heuristics):
- `components/BracketView.tsx` (public) — buckets by column; appends TBD future rounds via `futureRoundsAfter` so the Final still previews. Browser-verified: renders identically (SF + Final TBD + Champion TBD), 0 console errors.
- `components/admin/AdminBracketView.tsx` — `matchRounds`/`partialRounds` now from `groupByKnockoutRound`; deleted orphaned `bucketRounds`/`isValidBracketCount`; `hasValidMatches` = "last round has 1 match."

## BUG FOUND + FIXED during review (cross-file angle)
`AdminBracketView` `showStrayMatchesWarning` was `matches.length>0 && !hasValidMatches && bracketTeamCount>=2` — which fires TRUE for any valid PARTIAL bracket (e.g. the 2-SF case). The admin Structure tab would show a false *"⚠ N cross-group fixtures don't fit… aren't shown here"* warning **while showing those matches** — a contradiction that may be part of what the user perceived as "broken." Pre-existing (prior uncommitted session) but in my work area. Fixed: stray now = `countStrayKnockoutMatches` (matches with null/unknown round, the real "can't place" case), tested. Warning text updated.

## Verification
- `pnpm test`: 216 pass (14 files), incl. 13 new bracket tests.
- `tsc --noEmit`: clean.
- `eslint` on my 3 files: clean. (Repo-wide lint still fails on PRE-EXISTING errors in `MatchViews.tsx:129,136` — conditional hooks after `if (hideTabs) return` — NOT mine, NOT touched. Flagged below.)
- Browser: public bracket renders correctly, no regression.

## Review findings NOT fixed (out of scope / surgical) — for user awareness
- **R1 (pre-existing, real):** `MatchViews.tsx:129,136` — `useMemo` + `usePersistedView` called after an early `return` (conditional hooks). React rules-of-hooks ERROR. Latent bug; predates this session. Recommend fixing separately.
- **R2 (minor):** `AdminBracketView` labels real rounds by slot-COUNT (`roundLabel(round.length)`), not the round key. An odd-count round (data anomaly) would mislabel. `groupByKnockoutRound` drops the key in `.map(g=>g.matches)`; carrying it would fix this but expands scope.
- **R3 (cleanup):** three "halve counts for future rounds" implementations now coexist (`futureRoundsAfter` + AdminBracketView's `partialFutureRounds` loop + `buildPlaceholderRounds`). Consolidation deferred (untested prior-session code).

## Git state
NOT committed (per harness rule — user didn't ask). My changes this session: `lib/bracket.ts` (new), `__tests__/bracket.test.ts` (new), `components/BracketView.tsx`, `components/admin/AdminBracketView.tsx`. NOTE: working tree also has ~12 OTHER modified files from prior uncommitted sessions (UpNextRow, actions, MatchViews, etc.) and untracked `lib/match-phase.ts` — not mine this session.

## Work timeline
- Created this log.
- DB probe (subagent): data correct, 2 SF KO matches.
- Browser probe (direct): public bracket renders correctly. Feature works.
- Implemented Tasks 2–4 (groupByKnockoutRound) via TDD.
- Code review → found + fixed the false stray-matches warning bug (TDD).
- Final verification: 216 tests, tsc, lint, browser — all green.
