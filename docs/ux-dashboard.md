# UX Spec: Admin & Organizer Dashboard

**Date:** 2026-05-07
**Status:** Draft for review
**Scope:** UX (information architecture, flows, interaction patterns) for the management surface — `/admin/*`. UI/visual styling is out of scope.
**Audience:** Admin and Organizer roles. Scorekeeper (`/score`) and Participant (`/t/[id]`) UX live in their own docs.

---

## 1. Purpose & relationship to existing docs

This doc consolidates and supersedes the dashboard-related parts of:

- `docs/frontend/pages.md` — page list and routing
- `docs/frontend/screens.md` — screen-by-screen specs for `/admin/*`
- `docs/frontend/ux-spec.md` — interaction and lock rules for the management UI
- `docs/features/tournament/tournament-setup-view.md`
- `docs/features/tournament/tournament-edit-page.md`
- `docs/features/tournament/tournament-forms.md`
- `docs/features/admin/user-role-assignment.md`
- `docs/features/organizer/organizer-tournament-assignment.md`
- `docs/features/organizer/organizer-score-input.md`

Where this doc and the older docs disagree, **this doc wins**; the older docs should be revised to match (see §11).

The PRD (`docs/prd.md`) and backend specs (`docs/backend/*`) remain authoritative for functional requirements, data model, and RLS. Where the PRD needs to change, this doc flags the proposal in §10 — it does not silently override the PRD.

---

## 2. Personas (recap, dashboard-relevant only)

### Admin — *Priya, club system administrator*
Wants to set up the system once a season, then mostly stay out of the way. Cares about: who has access, who is running which tournament, fixing things when scorekeepers/organizers make mistakes.

### Organizer — *Daniel, tournament manager*
Runs one tournament end-to-end. Cares about: getting fixtures right, getting scorekeepers assigned in time for kickoff, watching the live match, and making sure the standings/bracket reflect reality. Phone-first during match days, laptop during setup.

**Critical insight for design:** Admin and Organizer use *the same tournament management surface*. The role only changes (a) which tournaments are visible and (b) which destructive/override actions are exposed. The dashboard is **role-aware, not role-separated**.

---

## 3. UX principles for this product

These principles guide every dashboard decision. Use them to resolve close calls.

1. **One tournament, one place.** All work for a tournament happens inside `/admin/tournaments/[id]`. Organizers should never need to chase a feature across a sidebar.
2. **Status drives affordance, not error.** If something can't be edited because the tournament is active, the input is disabled with a visible reason — never a surprise toast after submit.
3. **Phone-first on match day, laptop-first on setup day.** The tabs the organizer touches on match day (Fixtures, Standings) must be thumb-reachable. Setup-heavy tabs (Settings, Teams) tolerate laptop-only flows.
4. **Reversible by default; one explicit "danger zone" for the rest.** Most actions can be undone or edited until a status lock kicks in. Truly destructive actions (delete, archive) live in one named region.
5. **Show the lock, name the reason.** Disabled controls always carry a small lock icon and a one-line reason ("Locked — first match has been scheduled"). Never disable silently.

---

## 4. Top-level information architecture

### 4.1 Admin shell (left nav / top nav, role-aware)

```
/admin
├── Dashboard           — landing; tournament list filtered by role
├── Tournaments         — same list, dedicated view (filters, search)
├── Users               — Admin only
├── Audit log           — Admin only
└── Account             — current user's profile, password change
```

**Organizer sees:** Dashboard, Tournaments (filtered to assigned), Account. The "+ New Tournament" button is visible to Organizers — when an Organizer creates a tournament, they are auto-assigned as its first organizer (no admin handoff needed).
**Admin sees:** all of the above, plus Users and Audit log. Admin can also create tournaments and assign organizers separately on the Settings tab.

### 4.2 Tournament detail — tabs (the meat)

Inside `/admin/tournaments/[id]`, navigation is **horizontal tabs**, not separate pages. Each tab is a sub-route so deep links work and back-button behavior is correct.

```
/admin/tournaments/[id]
├── /overview           — tab 1: name, description, dates, venue, format, points, status, next-step checklist
├── /teams              — tab 2: teams (with players nested); for hybrid format, grouped by Group A/B/C
├── /fixtures           — tab 3: match schedule + lifecycle controls + score entry  ← match-day home base
├── /standings          — tab 4: live table (round-robin + hybrid only)
├── /bracket            — tab 5: knockout tree (knockout + hybrid only)
├── /scorekeepers       — tab 6: assignments
└── /settings           — tab 7: organizer assignments (admin-only), archive, delete
```

**Tab visibility by format:**

| Tab | round_robin | knockout | round_robin_knockout |
|---|---|---|---|
| Overview | ✓ | ✓ | ✓ |
| Teams | ✓ flat list | ✓ flat list | ✓ grouped by Group A/B/C |
| Fixtures | ✓ | ✓ | ✓ |
| Standings | ✓ | — | ✓ (group-stage only) |
| Bracket | — | ✓ | ✓ (knockout phase only) |
| Scorekeepers | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ |

**Why tabs over separate pages:**
- Mental model is "I'm working on tournament X" — context shouldn't shift each click
- Shared header (tournament name + status badge) stays visible across tabs
- Reduces back-and-forth: e.g. organizer can switch from Fixtures to Teams to verify a roster mid-scheduling without losing scroll position

**Tab order rationale:**
Read left-to-right as the tournament's life cycle: identity → who's playing → when they're playing → results → admin chores. Match-day organizers spend ~90% of their time on Fixtures, so it's positioned where the thumb naturally hits on mobile (3rd tab, center-ish).

### 4.3 Mapping to existing routes (migration)

| Old route | New route | Behavior |
|---|---|---|
| `/admin/tournaments/[id]` | `/admin/tournaments/[id]/fixtures` | Default tab — keeps "control center" feel |
| `/admin/tournaments/[id]/teams` | `/admin/tournaments/[id]/teams` | Same path, now a tab |
| `/admin/tournaments/[id]/fixtures` | `/admin/tournaments/[id]/fixtures` | Same path, now a tab |
| `/admin/tournaments/[id]/scorekeepers` | `/admin/tournaments/[id]/scorekeepers` | Same path, now a tab |
| `/admin/tournaments/[id]/edit` | **removed** — folded into Overview tab + Settings tab | See §6.1 |
| `TournamentSetupCard` (inline) | folded into Overview tab | See §6.1 |

The default tab when opening a tournament:
- Status = `setup` → **Overview** (next-step checklist guides them)
- Status = `active` → **Fixtures** (match day mode)
- Status = `finished` / `archived` → **Standings** or **Bracket** (read-only history)

**Mobile tab pattern:** all 7 tabs sit in a single horizontally-scrollable strip pinned to the top of the tournament view. The active tab auto-centers when selected. No hamburger, no bottom nav — one consistent spatial location for tab switching whether on phone or laptop. Standard pattern from Twitter / LinkedIn / most sports apps; one tap to switch.

---

## 5. Create tournament flow

### 5.1 Current pain (from existing docs)

- Single big form mixes low-stakes fields (name, dates) with high-stakes irreversible ones (format, points).
- Format choice has heavy downstream consequences (locks once first match is scheduled), but is presented as a casual radio button.
- Points-system docs contradict each other: PRD allows custom, `tournament-forms.md` allows only two presets.

### 5.2 Recommended flow — 3-step wizard (Step 3 is format-aware)

```
Click "+ New Tournament" on Dashboard
  ↓
Step 1 of 3 — Basics                        [Cancel]  [Next →]
  • Name *
  • Description (optional)
  • Venue *           [default: "Xiamen University Malaysia, Football Field"]
  • Start date *
  • End date *        [must be ≥ start_date]
  ↓
Step 2 of 3 — Format & rules                [← Back]  [Next →]
  • Format * (radio cards, with explanation)
      ◯ Round robin             "Every team plays every other team. Best for small groups."
      ◯ Knockout                "Single-elimination bracket. Best for large entries."
      ◯ Round robin + knockout  "Group stage, then knockout playoff. Best for tournaments with many teams."
  • Points system * (radio)
      ◯ Standard (3 / 1 / 0) — Win / Draw / Loss
      ◯ Half-point (1 / 0.5 / 0)
      ◯ Custom...   [reveals 3 number inputs]
  • Info banner: "Format and points lock once the tournament becomes Active (when the first match goes Live). You can still edit everything until then."
  ↓
Step 3 of 3 — Structure (conditional on format)   [← Back]  [Create tournament]

  ── If format = round_robin ──────────────────────────────
  • Step 3 is auto-skipped. No structural config needed.
  • Wizard completes immediately on "Create tournament" from Step 2.

  ── If format = knockout ─────────────────────────────────
  • Bracket size *  (radio: 4 / 8 / 16 / 32 teams)
  • Seeding mode * (radio)
      ◯ Manual — organizer assigns seeds later in Bracket tab
      ◯ Auto by entry order — first team registered gets top seed

  ── If format = round_robin_knockout (hybrid) ────────────
  • Number of groups *           (number input, default 4, min 2)
  • Teams per group *            (number input, default 4, min 2)
      → derived total = groups × teams_per_group; shown as "16 total team slots"
  • Teams advancing per group *  (number input, default 2, max = teams_per_group − 1)
  • Group seeding mode * (radio)
      ◯ Auto snake-draft (recommended) — system distributes teams; drag-drop override later
      ◯ Manual — organizer assigns each team to a group later
  • Info banner: "These structural numbers lock when the tournament becomes Active. You can still edit them while in Setup."
  ↓
On success → /admin/tournaments/[id]/overview  (status=setup)
              + toast "Tournament created. Add teams next."
              + Overview tab shows next-step checklist (see §6.1)
```

**Why a 3-step wizard with conditional Step 3:**
- Step 1 is low-stakes (basics) — answerable in 30 seconds, no decision fatigue.
- Step 2 forces the organizer to *read* the format explanations before committing, because that's all that's on the screen. Single forms cause people to skim past consequential radios.
- Step 3 captures format-specific structure upfront, so the organizer doesn't hit a half-configured tournament later. For round-robin (most common), Step 3 is auto-skipped — they're never even shown it. For hybrid, the group/advancement numbers go into a single screen rather than being scattered across the Teams tab and a separate Settings dialog.
- "Back" stays available across all steps — nothing is destructive until the final "Create tournament".

**Why not bury Step 3 inside the Teams or Settings tabs:**
- Hybrid format meaningless without group count + advancement count — those numbers determine the entire schedule.
- Discovering "wait, I need to set group count somewhere" after creating the tournament is exactly the friction the wizard exists to prevent.
- Setting structure numbers post-creation is still possible (Overview tab → Structure section, while status=setup), but the wizard makes it the obvious default path.

### 5.3 Validation & defaults

- **Required fields** marked with `*`; "Next" disabled until all required fields are valid (no submit-then-error).
- **Date pickers** default to today / today+7. End date min = start date.
- **Custom points** — accept decimals (matches PRD FR-12). Validate: win > draw ≥ loss ≥ 0.
- **Single primary CTA per step** ("Next →" / "Create tournament"). Cancel always available, opens "Discard?" confirm only if any field is touched.

### 5.4 Proposed PRD reconciliation

PRD says "custom points." Current `tournament-forms.md` says "two presets only." **Recommendation:** keep two presets for fast path, add "Custom..." as a third option. Resolves the contradiction; honors PRD.

---

## 6. Tournament detail tabs — per-tab spec

The shared header on every tab:

```
[← Tournaments]   Tournament name                 [status badge]
                  Venue · Date range
                  ─────────────────────────────────────────────
                  Overview · Teams · Fixtures · Standings · Bracket · Scorekeepers · Settings
```

Status badge is the canonical, always-visible truth: `Setup` / `Active` / `Finished` / `Archived`. Every disabled control on the page can be traced back to this badge.

### 6.1 Overview tab — *the home base for setup, the summary for active/finished*

**Purpose:** answer "what is this tournament, and what should I do next?" in under 5 seconds.

Sections (top to bottom):

1. **Tournament identity card** (editable inline per status)
   - Name, description, venue, start date, end date
   - Format and points system (read-only, shown for context)
   - Each field with a pencil icon when editable; locked fields show a 🔒 with reason on hover/tap.
   - Replaces the old `/edit` page and the inline `TournamentSetupCard`.

2. **Next-step checklist** (only when `status = setup`)
   ```
   Get this tournament ready to run:
   ☐ Add at least 2 teams                  → Teams tab
   ☐ Schedule at least 1 fixture           → Fixtures tab
   ☐ Assign a scorekeeper (optional)       → Scorekeepers tab
   ✓ Tournament basics filled in
   ```
   Each item is a link to the relevant tab. Items auto-check as the organizer completes them. Disappears once status flips to `active`.

3. **Live snapshot** (only when `status = active`)
   - Today's matches (next 3): time, teams, status, score
   - Quick links: "Open Fixtures," "Open Standings"

4. **Tournament summary** (only when `status = finished` / `archived`)
   - Champion / top of standings
   - Final standings link, final bracket link
   - Total matches played, total goals

5. **Structure card** — only when format ≠ `round_robin`
   - For `knockout`: bracket size, seeding mode (read-only after status=active)
   - For `round_robin_knockout`: number of groups, teams per group, teams advancing per group, group seeding mode
   - Editable while `status = setup`. Each value shows the same lock pattern as identity fields.
   - Changing group count or teams-per-group during setup re-runs auto snake-draft and confirms with: "This will reshuffle group assignments. Continue?" (skipped if seeding mode is Manual.)

**Edit lock matrix on this tab** (matches FR-34 + the `name` 14-day rule + revised FR-28):

| Field | setup | active | finished/archived |
|---|---|---|---|
| Name | ✓ if `start_date − today > 14d` | ✗ | ✗ |
| Description | ✓ | ✗ | ✗ |
| Venue | ✓ | ✗ | ✗ |
| Start date | ✓ | ✗ | ✗ |
| End date | ✓ | ✗ | ✗ |
| Format | ✓ | ✗ | ✗ |
| Points | ✓ | ✗ | ✗ |
| Structure (group count, advancement, etc.) | ✓ | ✗ | ✗ |

**Format / Points / Structure lock — revised semantics:**
The PRD's FR-28 currently says "format and points lock when the first match is scheduled." This spec proposes locking those fields when `status = active` (i.e. when the first match goes Live), not when the first match is merely scheduled. Reasoning: organizers frequently schedule fixtures, then realize the format needs adjustment before kickoff. Locking at "scheduled" forces them to delete fixtures to escape the lock, which is friction without safety benefit. Locking at "active" preserves the safety guarantee (no format change after live play) and aligns lock semantics with the visible status badge. See §10.1 for the proposed PRD edit. Changing format with scheduled fixtures shows a confirm: "Changing format will delete X scheduled fixtures. Continue?"

### 6.2 Teams tab — *who's playing, with optional rosters*

**Layout:** team cards, one per team. Each card collapsed by default; expand to see/edit players.

```
Teams (8)                                  [+ Add team]
┌─────────────────────────────────────────────┐
│ ▶ Team Lions                  4 players  ✎ │
│ ▶ Team Sharks                 0 players  ✎ │
│ ▶ Team Eagles                 — (no players) │
└─────────────────────────────────────────────┘
```

**Team card collapsed:** team name, jersey color (optional), player count, edit/delete actions.
**Team card expanded:** player table (name, jersey #, position) with "+ Add player" inline.

**Players are optional.** A team with 0 players is fully valid. The card shows a muted "No roster — add players to enable per-player stats" hint, not an error.

**Hybrid format (`round_robin_knockout`) — group view:**

```
Group stage                            4 groups · 4 per group · top 2 advance
                                       [+ Add team]  [Re-run auto snake-draft]
┌─ Group A ──────────────────────────────────┐
│ ▶ Team Lions             4 players       │
│ ▶ Team Sharks            6 players       │
│ ▢ (empty slot)                            │
│ ▢ (empty slot)                            │
└────────────────────────────────────────────┘
┌─ Group B ──────────────────────────────────┐
│ ▶ Team Eagles            5 players       │
│ ▶ Team Wolves            0 players       │
│ ▢ (empty slot)                            │
│ ▢ (empty slot)                            │
└────────────────────────────────────────────┘
```

Group count, teams-per-group, and advancement are set in the create wizard (Step 3) and shown read-only in the header strip here. To change them, the organizer goes to Overview → Structure card (only available while `status = setup`).

The Teams tab itself is for *populating* the groups: empty group slots are visible up to `teams_per_group`, and "+ Add team" lands the team in the first empty slot of the most-empty group (auto snake-draft mode) or prompts for group selection (manual mode).

**Auto snake-draft mode:** "+ Add team" places automatically. "Re-run auto snake-draft" reshuffles all teams (with confirm). Drag-drop a team between groups to override — overrides persist; subsequent auto-fills respect the manual placements.

**Manual mode:** "+ Add team" prompts "Add to which group?" with a dropdown. Drag-drop also works.

**Validation:** organizer cannot start the tournament (i.e., cannot begin Live on the first match) until every group has at least 2 teams. Settings tab and Fixtures tab will surface this as a blocker.

**Status locks:**
- `setup`: full add/remove/edit
- `active`: teams locked (FR-34); player edits locked for teams whose match has gone live (FR-21); player edits still allowed on teams that haven't kicked off yet
- `finished` / `archived`: read-only

**Empty state (`setup`, no teams):** "No teams yet. Add at least 2 teams before scheduling fixtures." with primary "+ Add team" button.

### 6.3 Fixtures tab — *the match-day nerve center*

This is the most-touched tab. Optimize ruthlessly for mobile + speed.

**Top of tab:**
- Filters: All / Today / Live / Scheduled / Finished
- Sort: by date (default) or by status (live first)
- "+ Schedule match" button (CTA)

**Match row (collapsed) — always shows:**
```
[time]   [Team A]  vs  [Team B]   [score]   [status badge]   [primary action]
```
where `[primary action]` adapts to status:

| Match status | Primary action button |
|---|---|
| Scheduled | **Start match** (green) |
| Live | **Half time** (amber) — score steppers visible above row |
| Halftime | **Start 2nd half** (green) — score steppers read-only |
| Finished | "View" — admin-only **Revert to live** in overflow menu |

**Match row (expanded — tap anywhere to expand):**
- Score steppers (`−` `0` `+` per team) — only writable in `live` state by Organizer or assigned Scorekeeper
- Edit match time (only for `scheduled` matches per FR-34; locked once `live`/`halftime`/`finished`)
- Assigned scorekeeper for this match (link to Scorekeepers tab)
- Match notes (free text, optional)
- Delete match (only if `scheduled`)

**Why expand-on-tap, not separate page:** match-day organizer needs to see 5+ matches at a glance and dive into one without losing context. A separate page per match would force re-orientation each time.

**Schedule match dialog** — single modal:
- Home team (dropdown)
- Away team (dropdown)
- Match time (datetime picker, defaults to next 30-min slot after last scheduled match)
- Validation: home ≠ away; time within tournament `start_date`–`end_date`; no duplicate fixture in round-robin if already played
- **For hybrid format:** dropdowns scoped to teams in the same group during group stage, all teams during knockout — controlled by a "Phase" segmented control (Group stage / Knockout) at top of dialog

**Status banner above match list (when relevant):**
- "Tournament is in **Setup**. Schedule fixtures here; the tournament becomes **Active** when the first match goes live." (setup state)
- "Tournament is **Active**. Teams and dates are now locked." (active, shown for first 24h after auto-transition, dismissible)

### 6.4 Standings tab — *the read-only outcome view*

- Visible only for `round_robin` and `round_robin_knockout` formats.
- Standings table (matches FR-31 fields): MP, W, D, L, GS, GC, GD, Pts.
- For hybrid: one table per group, side-by-side or stacked on mobile.
- Auto-updates from match results — no editing on this tab.
- "Last updated X seconds ago" indicator (long polling — 5s).
- Empty state (no matches finished yet): "Standings populate as matches finish."

### 6.5 Bracket tab — *the knockout view*

- Visible for `knockout` and `round_robin_knockout` formats.
- Two views, toggle at top: **Bracket tree** | **Match list** (per FR-32)
- Bracket tree: read-only visualization; clicking a match opens the same expand-on-tap drawer used in Fixtures (so editing flows are consistent).
- During `setup` for `knockout` format: shows seed slots; organizer fills slots from teams (drag-drop or dropdown).
- During `setup` for `round_robin_knockout`: bracket is locked until group stage finishes; shows "Bracket will populate after group stage matches are complete."

### 6.6 Scorekeepers tab — *who can input scores*

- List of scorekeepers assigned to this tournament.
- Each row: email, scope (Tournament-wide | Specific match), assigned-by, assigned-on, "Remove" action.
- "+ Assign scorekeeper" opens a dialog:
  - Email input — autocompletes from existing Scorekeeper accounts; if not found, "Invite new scorekeeper" opens admin-create flow (admin only).
  - Scope: "Whole tournament" or "Single match" (latter shows a match dropdown)
- Both Admin and Organizer can assign scorekeepers (FR-15). Organizer cannot create new Scorekeeper accounts — only Admin can (FR-25). The dialog gracefully handles this: if Organizer types a non-existent email, the message reads "No Scorekeeper account for this email. Ask an Admin to create one."

### 6.7 Settings tab — *admin chores & danger zone*

Three regions, top to bottom:

1. **Organizer assignments** (Admin-only)
   - List of organizers assigned to this tournament with "Remove" action.
   - "+ Assign organizer" — email autocomplete from existing Organizer accounts.
   - Hidden entirely for non-admins.

2. **Lifecycle**
   - "Mark tournament as finished" — primary action when all matches are `finished`. Disabled (with reason) otherwise.
   - "Archive tournament" — only available when `status = finished`. Makes everything read-only forever. Reversible by Admin only.

3. **Danger zone** (red-bordered region)
   - "Delete tournament" — requires typing the tournament name to confirm (FR-23).
   - Always available to Admin; available to Organizer only during `setup` status (proposed — see §10).

---

## 7. State machine UX — making locks visible

### 7.1 Tournament status: setup → active → finished → archived

```
[setup]  ──first match goes live──→  [active]  ──manual "Mark finished"──→  [finished]  ──manual archive──→  [archived]
                                                                                ↑
                                                       admin "Revert" (any finished match) keeps tournament active
```

**Auto-transition setup → active:** This is silent in the current docs. Make it loud:
- When the organizer hits "Start match" on the *first* match of a tournament, show a confirmation modal:
  > "Starting this match will activate the tournament. Teams, dates, format, points, and structure will be locked. Continue?"
- After confirm: status flips, status badge updates, a non-blocking banner appears on Overview ("Tournament activated") for 24 hours.
- This is the moment when format / points / structure lock — *not* when the first match was scheduled. See §6.1 lock matrix and §10.1 for the proposed FR-28 revision.

**Manual transition active → finished:** Currently undocumented. Add a "Mark tournament as finished" button on Settings tab, enabled only when 100% of matches have `status = finished`. Tooltip when disabled: "Finish all matches first (X remaining)."

**finished → archived:** Manual, on Settings tab. One-way for Organizer; Admin can un-archive.

### 7.2 Match status: scheduled → live → halftime → live → finished

Already specified in PRD FR-19. UX additions:

- Each lifecycle button confirms before firing on first use per session ("Start match — Lions vs Sharks?"); subsequent uses skip confirm to keep match-day pace.
- "Revert to live" (Admin only) always confirms with reason text input → logged to `admin_audit_log`.

### 7.3 Lock indicator pattern (cross-cutting)

Whenever a control is disabled because of status, show:
- Lock icon (🔒) inside or beside the field.
- Inline helper text in muted color: "Locked — first match scheduled."
- The control retains its label and value (don't hide content).

Examples of lock reasons (copy bank):

| Trigger | Helper text |
|---|---|
| `status = active` | "Locked — tournament is active." |
| `status = finished` / `archived` | "Locked — tournament is finished." |
| Match `status ≠ scheduled` | "Locked — match has started." |
| Name 14-day rule | "Name can only be changed up to 14 days before start." |

This addresses the digest's "users don't understand why field is disabled" pain point directly.

---

## 8. Cross-cutting interaction patterns

### 8.1 Confirmations

- **Reversible actions:** no confirm. Just do it; offer Undo toast for 5 seconds.
  - Add team, add player, schedule fixture, assign scorekeeper.
- **Irreversible / consequential:** modal confirm.
  - Start first match (consequential — flips tournament to active)
  - Delete team / player (loses data)
  - Mark tournament finished
  - Archive
  - Revert finished match (admin)
- **Catastrophic:** type-to-confirm modal.
  - Delete tournament (per FR-23)

### 8.2 Empty states

Every list has a designed empty state, never a blank panel:
- Teams: "No teams yet. Add at least 2 teams before scheduling fixtures." + CTA
- Fixtures: "No matches scheduled. Add teams first, then come back here." + CTA (disabled if 0 teams)
- Standings: "Standings populate as matches finish."
- Scorekeepers: "No scorekeepers assigned. The Organizer can input scores directly, or invite a Scorekeeper for delegation." + CTA

### 8.3 Toasts vs banners

- **Toast (transient, 4–5s):** success of a discrete action (created, updated, deleted), Undo affordance.
- **Banner (persistent, dismissible):** state changes that need acknowledgment (tournament activated, status changed by another user, etc.).
- **Modal:** confirms, errors that block submit, and only those.

### 8.4 Real-time / polling visibility

The participant view polls every 5s (NFR-03). The dashboard should also poll on Fixtures, Standings, Bracket — but show a subtle "Updated Xs ago · refreshing" indicator so multi-organizer scenarios (rare but possible) don't surprise users.

---

## 9. Key user flows

### Flow A — *Daniel sets up a new tournament from scratch (laptop, evening before)*

**Goal:** Tournament fully ready to run by tomorrow morning.
**Entry:** Dashboard → "+ New Tournament"
**Success criteria:** Tournament status = `setup`, ≥ 2 teams, ≥ 1 fixture, scorekeeper assigned.

1. Dashboard → "+ New Tournament" → Wizard step 1 → fills name, dates, venue → Next
2. Wizard step 2 → picks "Round robin", standard points → Create
3. Lands on Overview tab — sees next-step checklist
4. Clicks "Add at least 2 teams" → Teams tab → adds 6 teams (skips players for now)
5. Clicks "Schedule at least 1 fixture" → Fixtures tab → schedules 5 matches over 2 days
6. Clicks "Assign a scorekeeper" → Scorekeepers tab → enters volunteer's email, scope = whole tournament
7. Returns to Overview → all checklist items ✓ → ready

**Time target:** under 5 minutes (excluding typing 6 team names).

### Flow B — *Daniel runs match day (phone)*

**Goal:** Start matches on time, keep scores accurate.
**Entry:** Dashboard → tap tournament → defaults to Fixtures tab (because status=active).

1. Filters to "Today"
2. First match's row → primary action is "Start match" → tap → confirm modal "this will activate the tournament" → confirm
3. Score steppers appear inline; he can either input himself or watch the assigned scorekeeper input.
4. At halftime → tap "Half time"
5. Resume → tap "Start 2nd half"
6. Goal scored late → he or scorekeeper bumps the score
7. Tap "Full time" → match goes to `finished`, standings auto-update
8. Switches to Standings tab to verify; switches back to Fixtures for next match

### Flow C — *Priya (admin) reverts a disputed result (laptop, after the tournament)*

**Goal:** Fix a finished match that had wrong score recorded.
**Entry:** Admin → Tournaments → opens tournament → Fixtures tab.

1. Filters to "Finished"
2. Finds the match → overflow menu → "Revert to live"
3. Modal: "Revert this match? This will be logged. Reason: [text input]" → fills reason → confirm
4. Match returns to `live`; score steppers usable; she corrects the score; taps "Full time"
5. Audit log entry created (visible at /admin/audit)

### Flow D — *Admin onboards a new Organizer*

**Goal:** Give a club volunteer Organizer access to one tournament.
**Entry:** Admin → Users → "+ Add user".

1. Form: email, role = Organizer → Submit → toast shows generated default password
2. Admin → Tournaments → opens the relevant tournament → Settings tab
3. "Organizer assignments" → "+ Assign organizer" → enters email → done
4. Volunteer logs in, must change password, sees only that tournament on their Dashboard

This flow exposes a subtle point: **assigning a global Organizer role is meaningless without a tournament assignment.** The Settings tab's organizer-assignment section is where the access actually becomes useful, addressing the digest's pain point #6.

---

## 10. Proposed changes to PRD / feature docs

These are recommendations the UX redesign exposes — they are not unilateral edits.

### 10.1 PRD changes

1. **Add `round_robin_knockout` format to FR-17** — currently the PRD lists only round-robin and knockout. The schema + form docs already include it; the PRD should follow. Add an FR describing the hybrid format: "group stage round-robin within configurable groups, top N from each group advance to a knockout bracket."
2. **Add an FR for tournament status transition active → finished** — currently undocumented. Proposed: "FR-XX: Organizer or Admin must be able to mark a tournament as finished, available only when all matches have `status = finished`."
3. **Resolve points-system contradiction (FR-12)** — keep wording "custom points system values" and add note that the form provides two presets (3/1/0 and 1/0.5/0) plus a "Custom" option, which together satisfy FR-12.
4. **Add FR for Organizer self-create** — proposed wording: "An Organizer may create a new tournament; on creation, the creating Organizer is auto-assigned as the tournament's first organizer. Admin retains the ability to create tournaments and assign organizers separately." Avoids the admin bottleneck for routine tournament setup.
5. **Revise FR-28 — format/points/structure lock at status=active, not first-match-scheduled.**
   - Current FR-28: "Tournament format and points system lock once the first match is Scheduled (`first_match_scheduled_at` is set)."
   - Proposed: "Tournament format, points system, and structural parameters (group count, teams per group, advancement count) lock when the tournament transitions to `status = active` (i.e. when the first match goes Live). While in `setup`, these fields remain editable; if format is changed and scheduled fixtures exist, the system warns and deletes those fixtures on confirm."
   - Reasoning: locking at "scheduled" forces organizers to delete fixtures to escape the lock, which is friction without safety benefit. Locking at "active" preserves the no-change-after-live-play guarantee and aligns lock semantics with the visible status badge.
   - Schema implication: `first_match_scheduled_at` may still be useful as a flag for other concerns, but it stops being the lock trigger. Lock checks become `status = 'active'`.
6. **Add FR for hybrid tournament structural parameters** — proposed: "When format is `round_robin_knockout`, the tournament must specify: number of groups, teams per group, and number of teams advancing per group. These are set during creation (Step 3 of the create wizard) and editable while `status = setup`."

### 10.2 Feature doc changes

- `docs/features/tournament/tournament-edit-page.md` — supersede; the standalone `/edit` page goes away. Edits happen on Overview tab.
- `docs/features/tournament/tournament-setup-view.md` — supersede; this becomes the Overview tab spec.
- `docs/features/tournament/tournament-forms.md` — update to add "Custom" points option per §10.1.3.
- `docs/features/organizer/organizer-tournament-assignment.md` — update to specify the assignment lives on Settings tab (admin-only region).
- `docs/features/organizer/organizer-score-input.md` — already aligned (inline score steppers); reference the Fixtures tab section here.
- `docs/frontend/screens.md` — large rewrite needed; many screens consolidate into tabs.
- `docs/frontend/pages.md` — update routes to match §4.3 mapping.

### 10.3 New surfaces this doc introduces

- **Next-step checklist on Overview** (setup status only) — new pattern, not in current docs.
- **Auto-transition confirmation modal** — new, replaces silent transition.
- **"Mark tournament as finished" action on Settings** — new, fills a documented gap.
- **Lock indicator pattern** with copy bank — new, makes status visible.

---

## 11. Resolved decisions

These were open questions during the first draft of this spec and are now resolved. Listed here for traceability — anyone revising this spec should know what was already decided and why.

1. **Organizer can create tournaments** — auto-assigned as first organizer. Avoids admin bottleneck. PRD change captured in §10.1.4.
2. **Hybrid format group setup** — auto snake-draft by default with manual drag-drop override. Group count, teams per group, and advancement count are captured upfront in **Step 3 of the create wizard** (see §5.2), not scattered across post-creation tabs. Fully manual mode is also available.
3. **Group-stage advancement** — configurable per tournament, default top 2 per group. Setting lives on the Overview tab Structure card while `status = setup`. PRD change captured in §10.1.6.
4. **Format lock timing** — locks at `status = active`, NOT at first-match-scheduled. PRD change captured in §10.1.5 (revising FR-28). Format / points / structure all editable during setup; changing format with scheduled fixtures shows a confirm and deletes them.
5. **Mobile tab pattern** — horizontally-scrollable strip pinned to top, active tab auto-centers. One consistent location whether on phone or laptop. (See §4.3.)
6. **PWA install prompt** — NOT owned by this spec. The prompt lives on the participant view (`/t/[id]`), since participants benefit most from install for quick live-score access. Admin/organizer dashboard does not show a PWA prompt.

## 12. Truly open

Nothing currently blocking the spec. Items that may surface during implementation:

- Conflict resolution when two organizers edit the same tournament simultaneously (rare but possible). Defer until observed.
- Whether knockout bracket should auto-seed by group-stage finish position vs by overall points. Default proposal: by group-stage position with overall points as tiebreaker. Confirm during Phase 2 build.
- Behavior when a tournament has zero scorekeepers and the organizer is offline during a match. Mitigation: organizer can input scores directly from Fixtures tab; no scorekeeper required.

---

## 13. What's deliberately not in this doc

- Visual design (typography, color, spacing) — covered by future design system doc.
- Scorekeeper UX (`/score`) — separate doc.
- Participant UX (`/t/[id]` and homepage `/`) — separate doc.
- API contracts — `docs/backend/api-routes.md` is authoritative; this doc only references behavior.
- RLS policy details — `docs/backend/rls.md` is authoritative.

---

*End of spec.*
