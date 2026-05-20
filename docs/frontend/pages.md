# Pages

Every page and what it contains, section by section.

---

## `/` — Public Homepage

The entry point for anyone who receives a link to the club's platform.

### Sections

**Tournament list**
- Lists tournaments with `active` status only (`setup`, `finished`, and `archived` tournaments are not shown)
- Each card shows: tournament name, dates, location, format (round-robin / knockout), status badge
- Each card links to `/t/[id]` for that tournament

**Empty state**
- If no tournaments are active: "No tournaments running right now. Check back soon."

---

## `/t/[id]` — Public Tournament View

The main participant-facing page. No login required. Shared via WhatsApp or QR code.

### Header
- Tournament name, edition label, venue/location
- Live badge if any match is currently live
- WhatsApp share button — shares the current URL
- QR code button — shows QR code for the tournament URL

### Sticky tab strip
Tabs scroll-spy to the section currently in view. Tabs:
- **Live** — jumps to the hero section
- **Fixtures** — jumps to the fixtures section
- **Standings** — jumps to the standings table
- **Teams** — jumps to the teams section
- *(Bracket tab visible only for knockout format tournaments)*

### Hero — Live Match
Shown when at least one match is live. Displays the featured live match (the most recently started live match).

- Live pill with pulsing dot + "Live · Matchday N"
- Match group label, pitch name, referee name
- Both team crests, names, group tags
- Last 5 match form strip per team (W/D/L)
- Large animated scoreboard: home score — away score
- Running match clock (minute + period: 1H / 2H / HT)
- Goal scorer lines below the scoreboard — one per side, showing scorer name + minute

**If no match is live:** hero is hidden; page opens directly on the Fixtures section.

### Event Ticker
A horizontally scrolling marquee below the hero showing the latest events across all live matches:
- Goal icon, minute, match name, short description (e.g. "Owens fires from the edge. 2–1")
- Cards (yellow/red) shown with coloured rectangle icon
- Loops continuously while live matches are active

### Fixtures Section
- Section title: "Matches today · Matchday N"
- Filter chips: All · Live now · Upcoming · Full time
- Grid of match cards (see screens.md for card states)
- Sorted: Live first, then Upcoming by time, then Full time

### Standings Section
*(Round-robin format only)*
- One standings card per group
- Table columns: # · Team · P · W · D · L · GF · GA · Pts
- Top 2 rows highlighted with an advance indicator arrow
- Points bar — visual bar proportional to points total
- Label: "After N of N matchdays played"

### Bracket Section
*(Knockout format only — Phase 2)*
- Section title: "The bracket · Knockout stage"
- Visual bracket tree: QF → SF → Final → Champion
- Each match slot shows both teams, score (or "—" if not yet played), and time/status
- TBD slots shown as "Awaiting winner" with empty crest

### Teams Section
- Section title: "The teams · N clubs"
- Grid of team cards — one per team
- Each team card is collapsed by default; tap/click to expand
- Collapsed: team crest, name, group, player count, points total
- Expanded: W/D/L/GD stats strip + full roster list (jersey number, name, position, goals)

---

## `/t/[id]/team/[teamId]` — Team Roster Page

Dedicated roster page for a single team, linked from the Teams section.

### Sections
- Team header: crest, name, group
- Stats strip: W / D / L / GD / Pts
- Full player roster table: jersey number, name, position, goals scored
- Back link to `/t/[id]`

---

## `/admin` — Admin & Organizer Dashboard

Requires login. Landing page after sign-in.

### Sections

**Tournament list**
- Lists all tournaments the logged-in user can manage (admin sees all; organizer sees only their assigned ones)
- Each row: tournament name, dates, format, status badge (Setup / Active / Finished / Archived)
- Actions: click to open tournament detail

**Quick actions**
- "+ New Tournament" button (admin only, or organizer if given create access)

---

## `/admin/tournaments/new` — New Tournament Form

### Fields
- Name *
- Description
- Location
- Start date * / End date *
- Format toggle: Round-robin (default) / Knockout
- Points system: Win pts / Draw pts / Loss pts (defaults: 3 / 1 / 0)

**Submit:** creates tournament, redirects to `/admin/tournaments/[id]`

---

## `/admin/tournaments/[id]` — Tournament Detail

### Sections

**Stat cards row**
- Total teams, total matches, matches played, matches remaining

**Match list**
- All fixtures for this tournament
- Each row: match time, home team vs away team, score (or "—"), status badge
- Inline match status controls (see screens.md)

**Navigation links**
- Teams & Rosters → `/admin/tournaments/[id]/teams`
- Fixtures → `/admin/tournaments/[id]/fixtures`
- Scorekeepers → `/admin/tournaments/[id]/scorekeepers`

---

## `/admin/tournaments/[id]/teams` — Teams & Rosters

### Sections

**Add team form**
- Team name input + "Add Team" button
- Disabled once the first match is live (roster lock per FR-21)

**Team list**
- One expandable section per team
- Collapsed: team name, player count
- Expanded: player roster table + "Add Player" inline form (name, jersey number, position)
- Delete player button per row (disabled once any match for this team is live)

---

## `/admin/tournaments/[id]/fixtures` — Fixtures

### Sections

**Schedule a match form**
- Home team dropdown, Away team dropdown, Date + time picker
- "Schedule Match" button
- Validation: cannot schedule a team against itself; cannot schedule a team already playing at the same time

**Fixture list**
- All matches sorted by time
- Each row shows: time, home vs away, status, edit/delete actions
- Delete disabled once match is not in "scheduled" status

---

## `/admin/tournaments/[id]/scorekeepers` — Scorekeeper Assignment

### Sections

**Assign scorekeeper form**
- Email input (looks up existing user by email)
- Scope toggle: Entire tournament / Specific match
- If specific match: match dropdown (shows only scheduled/live matches)
- "Assign" button

**Current assignments list**
- One row per assignment: user email, scope (tournament-wide or match label), remove button

---

## `/admin/users` — User Management

*(Admin only)*

### Sections

**Add User panel**
- Short description: "Create an account. Share the default password with the user directly."
- "+ Add User" button → navigates to `/admin/users/invite`

**All Users list**
- One row per user: email, role badges (admin / organizer / scorekeeper)
- Roles shown as coloured pills: purple = admin, blue = organizer, green = scorekeeper
- Users with no roles shown as "No roles"

---

## `/admin/users/invite` — Add User

*(Admin only — despite the path name, this is the account creation form, not an invite)*

### Fields
- Email *
- Role radio: Organizer / Scorekeeper (with description of each)
- Info panel: "Account will be created with default password `footballclub`. User must change it on first login."
- "Create Account" button

**On success:** toast shows "Account created for [email]. Default password: footballclub"

---

## `/admin/login` — Admin Login

- Email + password form
- On success with `must_change_password` flag: redirects to `/change-password?redirectTo=/admin`
- On success without flag: redirects to `/admin` (or the original `redirectTo` param)
- Error state: inline error message below the form

---

## `/score` — Scorekeeper Screen

Requires login. Single focused screen — no navigation chrome beyond a sign-out link.

### Sections

**Match list**
- Shows only the matches assigned to the logged-in scorekeeper
- Live matches sorted to the top
- Each match: team names, current score, status badge, pitch + time

**Score entry (per live match)**
- Home score stepper: − / [number] / +
- Away score stepper: − / [number] / +
- Saves on every change (no submit button) — updates propagate to the public view in real time
- Disabled if match status is not "live"

**Empty state**
- If no matches assigned: "No matches assigned to you yet."

---

## `/score/login` — Scorekeeper Login

- Same form as `/admin/login` but with scorekeeper-specific visual style (dark background)
- On success with `must_change_password`: redirects to `/change-password?redirectTo=/score`

---

## `/change-password` — Forced Password Change

Shown to any user who logs in with the default password (`footballclub`).

### Fields
- New password (min 8 characters)
- Confirm password
- Validation: passwords must match; cannot reuse `footballclub`
- "Set Password" button

**On success:** clears `must_change_password` flag, redirects to original destination (`redirectTo` param)
