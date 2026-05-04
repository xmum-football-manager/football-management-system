# UX Spec

The "How" — interaction logic, state machines, and behavior rules for every surface.

---

## Global Rules

### Auth Guard
- `/admin` and `/score` are guarded by `proxy.ts` middleware.
- Unauthenticated requests redirect to the relevant login page with a `?redirectTo=` param preserving the intended destination.
- The login page itself is excluded from the guard (no redirect loop).
- Role checks are enforced at the DB layer (RLS). Frontend routing is a secondary UX guard only.

### Forced Password Change
- On successful login, both `/admin/login` and `/score/login` check `user_metadata.must_change_password`.
- If `true`: redirect to `/change-password?redirectTo=<original destination>` before granting access.
- `/change-password` clears the flag on success and redirects to `redirectTo`.

### Real-time (Public Tournament View)
- `TournamentView.tsx` subscribes to Supabase Realtime on the `matches` table — on any change it refetches scores, standings, and match status.
- Falls back to polling every 30 seconds if the WebSocket connection drops.
- Also refetches on `visibilitychange` (user returns to the tab).

### Match Status Lifecycle
```
scheduled → live → halftime → live → finished
                                   ↑
                           (Admin only revert)
```
- **Scheduled → Live** ("Start Match"): Organizer only. Locks team roster and fixture details for that match.
- **Live → Halftime** ("Half Time"): Organizer only.
- **Halftime → Live** ("Start 2nd Half"): Organizer only.
- **Live → Finished** ("Full Time"): Organizer only.
- **Finished → Live**: Admin only. Action is written to `admin_audit_log`.
- Scorekeeper can only enter scores while match status is `live`. During `halftime`, goal buttons are hidden and a "Half Time — waiting for 2nd half" message is shown. Controls are disabled for `scheduled` and `finished` as before.

### Tournament Edit Lock Rules

The following operations are allowed (✓) or locked (✗) based on tournament status:

| Operation | setup | active | finished / archived |
|---|---|---|---|
| Edit `start_date` / `end_date` | ✓ | ✗ LOCKED | ✗ LOCKED |
| Add / remove teams | ✓ | ✗ LOCKED | ✗ LOCKED |
| Add new scheduled fixtures | ✓ | ✓ | ✗ LOCKED |
| Delete a scheduled fixture | ✓ | ✓ | ✗ LOCKED |
| Edit `match_time` (match is `scheduled`) | ✓ | ✓ | ✗ LOCKED |
| Edit `match_time` (match is `live` / `halftime` / `finished`) | ✗ LOCKED | ✗ LOCKED | ✗ LOCKED |

Tournament status transitions:
- `setup` → `active`: when the first match transitions to `live`.
- `active` → `finished`: manually by Organizer or Admin when the tournament concludes.
- Any status → `archived`: Admin only.

Lock enforcement applies at both the UI layer (controls disabled) and the DB layer (RLS policies reject the write).

---

## `/` — Public Homepage

**Behavior:**
- Server-rendered list of all active tournaments.
- Each tournament card navigates to `/t/[id]`.
- Empty state: "No tournaments running right now. Check back soon."

No interactivity beyond navigation.

---

## `/t/[id]` — Public Tournament View

### Tab Navigation
- Five tabs: Live · Fixtures · Standings · Bracket · Teams
- Bracket tab is only shown for knockout-format tournaments.
- Default tab on load:
  - If any match is `live` → open on **Live** tab.
  - Otherwise → open on **Fixtures** tab.
- Tab strip is sticky (top: 57px, below the tournament header).
- Clicking a tab scrolls to and activates the corresponding section.
- Active tab is indicated by an animated underline indicator that slides between tabs.

### Hero — Live Match
- Shown only when at least one match has `status = 'live'`.
- Features the most recently started live match (`match_started_at` descending).
- Match clock counts up from `match_started_at` in real time (client-side `setInterval`).
- Goal scorer lines appear below the scoreboard, one per side, most recent first.
- If no live match: hero is hidden; page opens on Fixtures.

### Event Ticker
- Shown when any match is live.
- Horizontally scrolling marquee of events across all live matches.
- Loops continuously. Pauses on hover (desktop).
- Events: goals (with icon + scorer name + minute) and cards (yellow/red icon).

### Fixtures Section
- Filter chips: All · Live now · Upcoming · Full time
- Default: All.
- Sorted: Live first → Upcoming by scheduled time → Full time.
- Match cards update in real time via the Realtime subscription.

### Standings Section
- Round-robin format only.
- One card per group.
- Derived from the `standings` SQL view — no client-side aggregation.
- Top 2 rows highlighted with an advance indicator.
- Label updates after each round: "After N of N matchdays played."

### Bracket Section
- Knockout format only (Phase 2).
- Static render from current match results.
- "Awaiting winner" placeholder for unfilled slots.
- Toggle: visual bracket tree ↔ match list view.

### Teams Section
- Each team card is collapsed by default.
- **Tap/click to expand** in place — shows full roster.
- Roster table: jersey number · name · position · goals scored.
- Collapsed state shows: team name, group, player count, points.

### Share
- WhatsApp share button uses the native Web Share API (`navigator.share`) with the current URL.
- QR code button opens a modal with a QR code for the tournament URL.

---

## `/t/[id]/team/[teamId]` — Team Roster Page

- Static server render. No real-time updates.
- Back link to `/t/[id]`.

---

## `/admin` — Admin & Organizer Dashboard

### Access Control
- Admin sees all tournaments.
- Organizer sees only tournaments they are assigned to.

### Behavior
- "+ New Tournament" button navigates to `/admin/tournaments/new`.
- Tournament rows navigate to `/admin/tournaments/[id]`.
- Status badge reflects current tournament status: Setup / Active / Finished / Archived.

---

## `/admin/tournaments/new` — New Tournament Form

- All fields validated client-side before submit.
- Format toggle defaults to Round-robin.
- Points system defaults: Win = 3 / Draw = 1 / Loss = 0.
- On success: redirect to `/admin/tournaments/[id]` (the newly created tournament).

**Locks (post-creation):**
- Format toggle and points system values become read-only once the first match is scheduled (`first_match_scheduled_at` is set).

---

## `/admin/tournaments/[id]` — Tournament Detail

### Match Status Controls (inline per match row)
- **Scheduled** → shows "Start Match" button (Organizer only).
- **Live** → shows "Half Time" button + "Full Time" button (Organizer only) + score display.
- **Halftime** → shows "Start 2nd Half" button (Organizer only) + score display.
- **Finished** → shows "Revert to Live" button (Admin only). Clicking logs to `admin_audit_log`.
- All transitions are optimistic — the row updates immediately, then confirms from server.

### Navigation
- Four sub-section links: Teams & Rosters · Fixtures · Scorekeepers.
- Each opens the relevant sub-page.

---

## `/admin/tournaments/[id]/teams` — Teams & Rosters

### Add Team
- Form: team name input + "Add Team" button.
- Disabled once the first match for this tournament is `live` (FR-21 roster lock).

### Player Management (per team, expandable)
- Collapsed row: team name + player count.
- Expanded: player table + inline "Add Player" form (name, jersey number, position).
- Delete player button per row — disabled once any match for that team is `live`.

---

## `/admin/tournaments/[id]/fixtures` — Fixtures

### Schedule a Match
- Home team dropdown + Away team dropdown + date/time picker.
- Validation:
  - Cannot schedule a team against itself.
  - Cannot schedule a team already playing at the same time.
- "Schedule Match" button — disabled while submitting.

### Fixture List
- Sorted by scheduled time.
- Delete disabled once match status is not `scheduled`.
- `match_time` is editable inline while the match status is `scheduled`. Once a match is `live`, `halftime`, or `finished`, `match_time` is locked.
- Note: `match_time` is a public display estimate for the audience. It does not auto-start the match. The Organizer starts the match manually via "Start Match" on the tournament detail page.

---

## `/admin/tournaments/[id]/scorekeepers` — Scorekeeper Assignment

### Assign
- Email input → looks up existing user by email via `public.get_user_id_by_email()`.
- Scope toggle: Entire tournament / Specific match.
- If specific match: match dropdown shows only `scheduled` or `live` matches.
- Error if email not found in system.

### Remove
- Remove button per assignment. Instant — no confirmation dialog.

---

## `/admin/users` — User Management

- Admin only. Non-admins are redirected to `/admin`.
- "+ Add User" navigates to `/admin/users/invite`.

---

## `/admin/users/invite` — Create Account

- Role radio: Organizer / Scorekeeper.
- On success: toast — "Account created for [email]. Default password: footballclub"
- On error (e.g. email already exists): inline error below the form.
- After success: form resets. User stays on the page (does not navigate away).

---

## `/admin/login` — Admin Login

- Email + password → `supabase.auth.signInWithPassword`.
- Error: inline error message below the form (not a toast).
- On success with `must_change_password`: → `/change-password?redirectTo=/admin` (or original redirectTo).
- On success without flag: → `/admin` (or original redirectTo).
- Hitting Enter submits the form.

---

## `/score` — Scorekeeper Screen

### Match Selection
- If assigned to more than one match: shows a vertical list of match selector buttons at the top.
- Selected match is highlighted green.
- Clicking a button switches the score entry panel below.

### Score Entry
- Two steppers (home / away): − button · number · + button.
- Score saves on every button press — no explicit "Submit". Uses optimistic update.
- Stepper buttons are disabled if match status is not `live`.
- During `halftime`: goal buttons are hidden entirely. A message "Half Time — waiting for 2nd half" is displayed in place of the controls.
- Minimum value: 0 (− is disabled at 0).

### Empty State
- If no matches assigned: "No matches assigned to you yet."

---

## `/score/login` — Scorekeeper Login

- Same logic as `/admin/login`.
- Dark background style (`bg-[#0f172a]`).
- On success with `must_change_password`: → `/change-password?redirectTo=/score`.

---

## `/change-password` — Forced Password Change

- Shown to any user who logged in with the default password.
- Validation:
  - New password ≥ 8 characters.
  - Confirm password must match new password.
  - New password cannot be `footballclub`.
- All validation is client-side before submit.
- On success: clears `must_change_password` in `user_metadata`, redirects to `redirectTo` param.
