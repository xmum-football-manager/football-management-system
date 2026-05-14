# Organizer Tournament Setup Wizard — Design

**Date:** 2026-05-13
**Status:** Draft (awaiting user review)
**Source of truth:** `ux.txt` (UX analysis of organizer/scorekeeper sketches)
**Replaces:** the single-form `/admin/tournaments/new` page

---

## Goal

Replace the existing single long form for creating a tournament with a 5-step wizard that reduces organizer cognitive load and supports the football-specific configuration `ux.txt` calls for (match rules, conditional format fields, scoring options).

Scope is **config only**. The wizard creates a tournament row. Teams, fixtures, and scorekeepers continue to be added via the existing `/admin/tournaments/[id]/{teams,fixtures,scorekeepers}` sub-pages, unchanged by this spec.

---

## Out of scope (deferred)

- Adding teams inside the wizard
- Auto-generating fixtures (round-robin schedule, knockout bracket)
- Scorekeeper UI redesign (tap-player-first, event timeline, cards, substitutions)
- The live penalty shootout flow itself (we store the config flag only)
- Tournament card scannability improvements on the `/admin` dashboard

These will be designed in separate specs.

---

## Wizard Structure

```
Step 1 — Basic Info          → name, description, location, dates
Step 2 — Format              → format choice + conditional fields
Step 3 — Match Rules         → halves, durations, extra time, penalty shootout
Step 4 — Points & Scoring    → points system + player attribution toggle
Step 5 — Review              → summary of all fields, [Back] [Create Tournament]
```

**Common chrome:**
- Top of every step: progress indicator `① ─ ② ─ ③ ─ ④ ─ ⑤` (current step highlighted)
- Bottom of every step: `[Back]` and `[Next]` buttons. `Next` is disabled until all required fields on the current step are valid. On Step 5, `Next` is replaced by `[Create Tournament]`.
- Each step shows inline validation errors below the offending field. The user cannot advance until errors are cleared.

**Entry / exit:**
- Entry: `/admin/tournaments/new` (same URL as today)
- Exit on success: `/admin/tournaments/[id]` — the tournament detail page, same as today
- Cancel: `← Dashboard` link in header, returns to `/admin` without saving

---

## Step 1 — Basic Info

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Name | text | yes | — | |
| Description | textarea | no | — | |
| Location | text | no | `"Xiamen University Malaysia, Football Field"` | matches existing default |
| Start date | date | yes | — | |
| End date | date | yes | — | must be ≥ start date |

---

## Step 2 — Format (conditional fields)

```
Format: ( ) Round Robin
        ( ) Round Robin + Knockout
        ( ) Knockout Only
```

### If format includes Round Robin

| Field | Type | Required | Notes |
|---|---|---|---|
| Number of groups | int ≥ 1 | yes | |
| Teams per group | int ≥ 2 | yes | |
| Teams advancing per group | int ≥ 1 | yes — **Hybrid only** | hidden for RR-only |

### If format includes Knockout

| Field | Type | Required | Notes |
|---|---|---|---|
| Knockout starts at | enum | yes | `top_32 \| top_16 \| top_8 \| semi \| final` |
| Seeding method | enum | yes | `by_standings \| manual \| random` |

**Seeding method values:**
- `by_standings` — derive seeds from group-stage points, goal difference, goals scored
- `manual` — organizer assigns seeds on the bracket page later
- `random` — system shuffles qualified teams

Manual override of standings or bracket positions happens on the **fixtures/bracket page after creation**, not in the wizard.

---

## Step 3 — Match Rules

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Halftime break | radio (Yes/No) | yes | Yes | |
| Time per half | int (minutes) | yes | 45 | |
| Halftime duration | int (minutes) | yes if break = Yes | 15 | hidden if break = No |
| Extra time duration | int (minutes) | no | 15 | 0 or blank = no extra time |
| Penalty shootout as tiebreaker (best of 5) | checkbox | no | unchecked | stores config flag only; live shootout flow is out of scope |

---

## Step 4 — Points & Scoring System

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| Win | number | yes | 1 | accepts decimals |
| Draw | number | yes | 0.5 | accepts decimals |
| Loss | number | yes | 0 | accepts decimals |
| Require player attribution for goals | checkbox | no | unchecked | when unchecked, scorekeeper can skip player selection |

**Validation:** must satisfy `win > draw > loss`. Inline error shown if violated; `Next` disabled.

---

## Step 5 — Review

Read-only summary, grouped by step, with `Edit` links that jump back to the relevant step (preserving entered data). Example:

```
Basic Info                                              [ Edit ]
   Name: Spring Cup 2026
   Dates: 1 May 2026 → 15 May 2026
   Location: Xiamen University Malaysia, Football Field

Format                                                  [ Edit ]
   Round Robin + Knockout
   Groups: 2 · Teams per group: 4 · Advance per group: 2
   Knockout from: Top 8 · Seeding: by standings

Match Rules                                             [ Edit ]
   2 × 45 min halves · 15 min halftime
   Extra time: 15 min · Penalty shootout: enabled

Points & Scoring                                        [ Edit ]
   Win 1 · Draw 0.5 · Loss 0
   Player attribution: not required
```

Bottom: `[Back]` `[Create Tournament]`. On click, `INSERT` into `tournaments` and redirect to `/admin/tournaments/[id]`.

---

## Data Model Changes

New columns on `tournaments`:

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `halftime_enabled` | bool | no, default true | |
| `minutes_per_half` | int | no | |
| `halftime_minutes` | int | yes | required iff `halftime_enabled = true` |
| `extra_time_minutes` | int | yes | null or 0 = no extra time |
| `penalty_shootout_enabled` | bool | no, default false | config flag only |
| `require_goal_player` | bool | no, default false | |
| `num_groups` | int | yes | non-null iff format includes RR |
| `teams_per_group` | int | yes | non-null iff format includes RR |
| `advance_per_group` | int | yes | non-null iff format is Hybrid |
| `knockout_start_round` | text enum | yes | non-null iff format includes KO; `top_32 \| top_16 \| top_8 \| semi \| final` |
| `seeding_method` | text enum | yes | non-null iff format includes KO; `by_standings \| manual \| random` |

Existing columns kept unchanged: `name, description, location, start_date, end_date, format, points_win, points_draw, points_loss, status, ...`.

Migration must be additive (no breaking changes to existing rows). Sensible defaults backfilled for any existing tournaments: `halftime_enabled=true, minutes_per_half=45, halftime_minutes=15, extra_time_minutes=null, penalty_shootout_enabled=false, require_goal_player=false`. Format-conditional columns left null on existing rows.

---

## Component Boundaries

To keep the wizard code reasoned-about in isolation:

- `TournamentWizard` (client component) — orchestrates step state and navigation. Owns the in-memory form state across all steps.
- `WizardStepShell` — progress indicator + Back/Next buttons. Generic.
- `Step1BasicInfo`, `Step2Format`, `Step3MatchRules`, `Step4PointsScoring`, `Step5Review` — one file per step, each receives `{ value, onChange, errors }`.
- `createTournament` server action — receives the full validated payload, performs the insert, returns the new tournament id.

Each step component is independently testable: given a form-value object and an onChange handler, render the right fields and validations. The shell does not know which step it is rendering.

---

## Lock Behavior (interaction with FR-34)

The wizard runs only during initial creation. Existing edit rules (FR-34 in the PRD) continue to govern the post-creation `/admin/tournaments/[id]/edit` page:

- Match rules and format-conditional fields **lock once `first_match_scheduled_at` is set**, the same as the current `format` and points-system fields (FR-28).
- The edit page must be updated to surface the new columns as editable fields *before* lock and read-only *after* lock. That edit-page update is part of this spec's implementation.

---

## Open Questions / Things to Confirm

None — design approved by user 2026-05-13.

---

## Spec Self-Review Notes

- Placeholder scan: no TBDs in design fields. ✓
- Internal consistency: format conditional logic matches Step 2 and the data-model nullability rules. ✓
- Scope check: focused on a single wizard + supporting data-model migration + edit-page extension. Single implementation plan size. ✓
- Ambiguity check: validation rules, defaults, and nullability called out explicitly per column. ✓
