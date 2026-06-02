# Knockout Bracket Advancement — Design Spec

**Date:** 2026-06-02
**Status:** Approved (design); pending implementation plan

## Problem

In the knockout stage, the winners of two matches must flow into the match that
joins them. If match A and match B feed match C, then C must display
**"Winner of A" vs "Winner of B"** before those matches are played, and the
real teams must drop into C's slots automatically once A and B finish. This must
work for every round: Round of 32 → Round of 16 → Quarterfinal → Semifinal →
Final.

The current implementation cannot do this. See "Current model" below.

## Current model (what exists today)

### Group stage
A match is a row: `phase='group'`, two **concrete** team ids, a `match_time`,
score, status. Matches are independent; standings/qualifiers are derived from
results (`lib/qualifiers.ts`). No match references another match.

### Knockout stage
Same row shape: `phase='knockout'`, `knockout_round ∈ {r32,r16,qf,sf,final}`,
two **non-nullable** team ids, score, status.

- Round 1 matches are created up front from qualifiers or the manual
  `BracketSetupView` (`createManualKnockoutAction`).
- Later rounds are created **lazily** by `advanceBracketIfReady`
  (`app/admin/tournaments/[id]/actions.ts:117`) when a match finishes — but only
  once **both** matches of a pair are done.
- The "A and B feed C" relationship is **implicit**, reconstructed at finish-time
  from `created_at` ordering within a round (`partnerIdx = idx%2 ? idx-1 : idx+1`;
  lower index becomes home).
- Rendering buckets real matches with `groupByKnockoutRound` (`lib/bracket.ts`)
  and draws **fake TBD placeholder columns** via `futureRoundsAfter`.

### Why it can't meet the goal
1. **No edge in the data.** C doesn't know A and B feed it; the link is rebuilt
   from `created_at` index — the array-position fragility `lib/bracket.ts` was
   created to eliminate, yet the advance logic still relies on it.
2. **C doesn't exist until both parents finish**, so there is no node to label
   "Winner of A vs Winner of B" beforehand — only a generic fake column.
3. **Team slots are non-nullable**, so C cannot be pre-created empty.
4. **Draws stall the bracket** — advance silently aborts when either parent is a
   draw; KO has no draw resolution.
5. **Dedup is heuristic** ("does a team already appear next round?") and can
   misfire.

## Ideal model (approved)

The bracket is a **structure that exists up front, with explicit edges**. Every
match node for every round is created at setup time. Each team-slot is one of:

- a **concrete team** (group qualifiers seeding round 1), or
- a **reference to a feeder match** ("winner of match A"), rendered as
  "Winner of A" until that match finishes, then auto-filled.

When a match finishes, its winner flows into the exact slot that points at it —
deterministic, no `created_at` guessing, no dedup heuristic, draws handled by an
explicit winner field.

## Design

### 1. Data model changes (one migration)

Add to the `matches` table:

| Column | Type | Meaning |
|---|---|---|
| `home_team_id` | **change to nullable** | empty until a feeder resolves |
| `away_team_id` | **change to nullable** | empty until a feeder resolves |
| `home_source_match_id` | `uuid null` → `matches.id` | home slot = winner of this match |
| `away_source_match_id` | `uuid null` → `matches.id` | away slot = winner of this match |
| `winner_team_id` | `uuid null` → `teams.id` | who advances; auto from score, admin-set on draw |

Group matches leave all new columns null and keep both team ids — behaviour
unchanged.

This migration also **formalizes existing schema drift**: `phase` and
`knockout_round` currently exist only on the remote DB, not in any repo
migration. The migration declares them properly alongside the new columns.

**Ripple (main blast radius):** making `home_team_id`/`away_team_id` nullable
means the `Match` TypeScript type and every reader that assumes a concrete
`home_team_id` must tolerate null. Group-stage code paths are left untouched;
null-handling is isolated to knockout rendering. The implementation plan must
enumerate every reader.

### 2. Bracket skeleton generation (replaces lazy creation)

When the admin finalizes round-1 seeding (`createManualKnockoutAction` /
`BracketSetupView`), generate **all rounds at once**:

- **Round 1:** N matches with concrete teams (as today).
- **Rounds 2…Final:** empty matches with `home_source_match_id` /
  `away_source_match_id` wired to the two feeding matches; team ids null.
- Pairing is **explicit via these refs** — no `created_at` index.
- **Guard:** N must be in {2, 4, 8, 16, 32}; otherwise reject.

### 3. Advancement (rewrite `advanceBracketIfReady`)

On marking a KO match finished:

1. Compute `winner_team_id` from score; if level, require the admin's explicit
   pick (UI in §5). Advancement **always reads `winner_team_id`**, never
   re-derives from score.
2. Find the match whose `home_source_match_id` **or** `away_source_match_id`
   equals this match's id, and write the winner into the matching slot.
3. No dedup heuristic, no `created_at`, no draw stall.

### 4. Rendering ("Winner of A" → real team)

`BracketView` + `AdminBracketView` already bucket with `groupByKnockoutRound`. A
slot renders as:

- the team, if `*_team_id` is set; otherwise
- **"Winner of {feeder match label}"**, derived from the source match.

`futureRoundsAfter` and its fake placeholder columns are **deleted** — rounds are
now real, queryable matches.

### 5. Draw resolution UI

On the admin match view, if a finishing/finished KO match is level on score, show
a "Who advances?" picker that sets `winner_team_id`. When a winner is implied by
score, no picker is shown.

### 6. New-tournament setup

The power-of-two guarantee already holds: `knockout_start_round`
(`final`=2, `semi`=4, `top_8`=8, `top_16`=16, `top_32`=32) fixes the total, and
`NewTournamentForm.tsx:90` rejects any `groups × advance` split that isn't a
whole number. Add an explicit assertion + small shared helper so the manual KO
path is also protected. **No new tournament fields.**

## Scope & relationship to in-flight work

- **Supersedes** the in-flight `2026-06-02-knockout-bracket-sync` plan's lazy
  advancement. The `groupByKnockoutRound` work stays and is built upon; the old
  `advanceBracketIfReady` is replaced.
- Byes / non-power-of-two team counts are **out of scope** — bracket size is
  always a power of two by construction.

## Success criteria

1. Finalizing a knockout bracket of N (∈ {2,4,8,16,32}) teams creates the full
   set of matches for all rounds, with later-round slots showing
   "Winner of {match}".
2. Finishing both feeder matches of any match auto-fills that match's two slots
   with the correct winners, for every round (r32 → final).
3. A level KO match requires an explicit winner pick before it advances; that
   pick (not the score) determines who flows forward.
4. The public and admin brackets render placeholder slots before resolution and
   real teams after, keyed on the authoritative `knockout_round` column.
5. Group-stage behaviour is unchanged.
