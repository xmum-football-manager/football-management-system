# Component Map

Quick reference for where every UI component lives and what uses it. Use this before touching any component to understand blast radius, and after adding a component to keep it updated.

---

## Surface legend

| Symbol | Surface |
|---|---|
| **PUB** | Public-facing (`/`, `/t/[id]`, `/t/[id]/team/[teamId]`) |
| **ADM** | Admin panel (`/admin/...`) |
| **SCR** | Scorekeeper app (`/score`) |

---

## Shared component library — `components/`

True shared library components. Changing anything here can affect multiple pages.

### Public — `components/` (no sub-folder)

| Component | Used by | Notes |
|---|---|---|
| `HeroLive` | `TournamentView` | Always rendered; `variant` prop: `live` / `nextup` / `done` |
| `BracketView` | `TournamentView` (Bracket tab) | Read-only public bracket. **Distinct from `AdminBracketView`** |
| `MatchCard` | `TournamentView` (Live + Fixtures tabs) | One match card; renders `LiveBadge` internally |
| `StandingsTable` | `TournamentView` (Standings tab) | Used for single league and per-group rendering |
| `TeamCard` | `TournamentView` (Teams tab) | Links to `/t/[id]/team/[teamId]` |
| `TournamentCardItem` | `app/page.tsx` (home listing) | One card per active tournament |
| `LiveBadge` | `HeroLive`, `MatchCard` | Animated red dot + "LIVE" label. Props: `size?: 'sm' \| 'md'` (default `'md'`) |

### Admin — `components/admin/`

| Component | Used by | Notes |
|---|---|---|
| `MatchViews` | Admin overview, `rd-fixtures`, `ko-fixtures` | The big one — List / Board / Structure sub-views. Structure view embeds `AdminBracketView` internally. Contains its own private `MatchdayCard` (board cards — note lowercase 'd', not the same as the overview's `MatchDayCard.tsx`) |
| `AdminBracketView` | `MatchViews` (structure view), `KnockoutStepper` | Interactive bracket with click handlers. **Distinct from public `BracketView`** |
| `MatchStatusBadge` | `MatchViews` (internal board `MatchdayCard` only) | Tiny status chip. NOT used in the overview `MatchDayCard.tsx` |
| `MatchStateStepper` | `MatchRow` | Status pill sequence: scheduled → live → halftime → finished |
| `QualifierSelector` | `FixturesPanel` | Shown only when: `format === 'round_robin_knockout' && canEdit && knockoutSlots > 0 && knockoutSlots % 2 === 0` |
| `TournamentStatusBadge` | `app/admin/page`, `app/admin/tournaments/[id]/layout` | Draft / Active / Finished badge |
| `ThemeToggle` | `app/admin/layout` | Dark/light toggle, admin sidebar only |

### Orphaned (defined but not imported by any page)

| Component | Notes |
|---|---|
| `StandingsCard` (`components/StandingsCard.tsx`) | Not used anywhere. `MatchViews` has its own private internal `StandingsCard` function |
| `QrModal` | Not used anywhere. Has a story file |
| `Toast` (`components/Toast.tsx`) | Superseded by `sonner` (`components/ui/sonner.tsx`) |

---

## Page-local components — `app/admin/tournaments/[id]/`

These live inside the app directory, not in `components/`. They are specific to the tournament admin section and are **not** intended to be reused outside it.

| Component | File | Used by | Notes |
|---|---|---|---|
| `FixturesPanel` | `fixtures/FixturesPanel.tsx` | `rd-fixtures/page`, `ko-fixtures/page` | Thin wrapper: lock warning + count + `MatchViews` + `QualifierSelector` |
| `MatchRow` | `MatchRow.tsx` | `MatchViews` (List view) | One row per match; embeds `MatchStateStepper` |
| `MatchDayCard` | `MatchDayCard.tsx` | Admin overview `page.tsx` | Today's match widget with live score controls. **Not the same as `MatchdayCard` inside `MatchViews`** |
| `UpNextRow` | `UpNextRow.tsx` | Admin overview `page.tsx` | Next scheduled match with quick-start button |
| `TournamentNav` | `TournamentNav.tsx` | `app/admin/tournaments/[id]/layout` | Tab navigation for the tournament section |
| `KnockoutStepper` | `knockout/KnockoutStepper.tsx` | `knockout/page.tsx` | Multi-step KO setup wizard; contains `QualifiersStep`, `BracketSetupView`, `AdminBracketView` |
| `BracketSetupView` | `knockout/BracketSetupView.tsx` | `KnockoutStepper` | Step 2 of KO wizard: draw the bracket manually |
| `QualifiersStep` | `knockout/QualifiersStep.tsx` | `KnockoutStepper` | Step 1 of KO wizard: confirm which teams advance |

---

## Page → component tree

### Public surfaces

```
app/page.tsx  (home)
└── TournamentCardItem

app/t/[id]/page.tsx  (tournament public view)
└── TournamentView
    ├── HeroLive          (always rendered; variant: live | nextup | done)
    │   └── LiveBadge
    ├── MatchCard × N     (Live tab + Fixtures tab)
    │   └── LiveBadge
    ├── StandingsTable    (Standings tab; also called inside GroupStandings helper)
    ├── BracketView       (Bracket tab; KO-phase matches only via phase === 'knockout' filter)
    └── TeamCard × N      (Teams tab)

app/t/[id]/team/[teamId]/page.tsx  (team roster)
└── (self-contained — no shared components)
```

### Scorekeeper surface

```
app/score/page.tsx
└── ScoreApp  (self-contained — no shared components)
```

### Admin surfaces

```
app/admin/page.tsx  (tournament list)
└── TournamentStatusBadge

app/admin/tournaments/[id]/layout.tsx
├── TournamentNav
└── TournamentStatusBadge

app/admin/tournaments/[id]/page.tsx  (overview — passes real tournament.format, no override)
├── MatchViews            (all matches, no hideTabs — full view/tab controls shown)
│   ├── AdminBracketView  (structure view; format-aware: league flow vs bracket)
│   ├── MatchRow × N      (list view)
│   │   └── MatchStateStepper
│   └── MatchdayCard × N  (board view — private to MatchViews; uses MatchStatusBadge)
├── MatchDayCard × N      (today's live match widget — separate component, no MatchStatusBadge)
└── UpNextRow             (next scheduled match)

app/admin/tournaments/[id]/rd-fixtures/page.tsx
│   (format overridden to 'round_robin'; only group matches passed)
└── FixturesPanel  (hideTabs=true → no view toggle, always renders ListView)
    └── MatchViews
        ├── AdminBracketView  (structure view — league flow)
        ├── MatchRow × N      (list view)
        └── MatchdayCard × N  (board view — private; uses MatchStatusBadge)

app/admin/tournaments/[id]/ko-fixtures/page.tsx
│   (format overridden to 'knockout'; only KO matches passed)
└── FixturesPanel
    ├── QualifierSelector     (round_robin_knockout only, when slots valid)
    └── MatchViews
        ├── AdminBracketView  (structure view — bracket)
        ├── MatchRow × N      (list view)
        └── MatchdayCard × N  (board view — private; uses MatchStatusBadge)

app/admin/tournaments/[id]/knockout/page.tsx  (KO setup wizard)
└── KnockoutStepper
    ├── QualifiersStep
    ├── BracketSetupView
    └── AdminBracketView      (live bracket preview)
```

---

## Phase-filtering rules

Several components receive a pre-filtered match list. This is intentional — understand it before adding match queries.

| Page / component | What matches it receives | How filtered |
|---|---|---|
| `rd-fixtures/page` | Group-stage matches only | `isGroupStageMatch(m)` — both teams share the same non-null `group_label` |
| `ko-fixtures/page` | KO matches only | `!isGroupStageMatch(m)` |
| `TournamentView` (public) | All except truly unscheduled future ones | `match_time !== null \|\| status !== 'scheduled'` |
| `BracketView` (public bracket tab) | KO matches only | `phase === 'knockout'` |
| `MatchViews` (admin overview) | All matches | No filter — full list passed |

> **`isGroupStageMatch` is a heuristic**, not a DB column check. It relies on both teams having an equal non-null `group_label`. If a KO match ever pits two teams from the same group, it would be misclassified. The `phase` column (`'group'` / `'knockout'`) on the match row is the authoritative source — prefer filtering by `phase` if this heuristic becomes unreliable.

---

## UI system split

There are **two visual systems** in this repo. Do not mix them.

| System | Used by | Tokens / classes |
|---|---|---|
| **Public design** (dark, lime-accented) | All `PUB` surfaces | CSS vars: `--ink-*`, `--brand-lime`, inline `style={}` objects |
| **Admin design** (shadcn/ui + custom vars) | All `ADM` + `SCR` surfaces | Tailwind classes, `--admin-*` vars, `components/ui/*` primitives |

`components/ui/` (button, card, dialog, select, etc.) are **admin-only**. Never import them into public-facing components.

---

## `lib/` utility modules

Shared logic that does not render UI. Import from here instead of writing local copies.

| Module | Exports | Who uses it |
|---|---|---|
| `lib/format.ts` | `teamInitials`, `formatClock`, `formatMatchTime`, `formatRange` | All surfaces — public components, admin components, pages |
| `lib/match-phase.ts` | `isGroupStageMatch`, `isKnockoutMatch` | Admin pages: `ko-fixtures`, `rd-fixtures`, `knockout/page`, `layout`, `MatchViews` |
| `lib/qualifiers.ts` | `computeGroupStandings` | `knockout/page.tsx` (determines which teams advance) |
| `lib/lock-rules.ts` | `canAddFixture`, `canManageTeams` | Admin fixture + team pages |

`lib/format.ts` notes:
- `teamInitials(name)` — 2-letter team avatar from name words
- `formatClock(iso)` — time only, HH:MM 24h (e.g. "14:30")
- `formatMatchTime(iso)` — time + date (e.g. "2:30 PM, May 15")
- `formatRange(start, end)` — date range string

> **Rule:** Before writing a local formatting or phase-checking helper, search `lib/` first. If it's not there and it's used in more than one file, add it to the right module.
