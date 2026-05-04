# Screens

The "What" — visual layout, component anatomy, and states for every screen and key component.

---

## Design System Baseline

| Property | Value |
|---|---|
| Font | System sans-serif (Tailwind default) |
| Admin surface | shadcn/ui components on white/slate backgrounds |
| Public + Scorekeeper | Custom Tailwind, dark background (`#0f172a` / `#0e1a12`) |
| Primary accent | Green (`green-600` / `green-500` hover) |
| Mobile-first | All layouts start at 375px wide |

---

## `/` — Public Homepage

```
┌─────────────────────────────────────┐
│  ⚽ [Club Name]          [Nav bar]  │
├─────────────────────────────────────┤
│  Active Tournaments                 │
│  ┌─────────────────────────────┐   │
│  │ [Tournament Name]           │   │
│  │ 12–18 May · Stadium Name    │   │
│  │ Round-robin  ● Active       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ...                         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ── Empty state ──                  │
│  "No tournaments running right now. │
│   Check back soon."                 │
└─────────────────────────────────────┘
```

**Tournament card:**
- Name (bold)
- Date range + location (slate-500, small)
- Format badge (round-robin / knockout, grey pill)
- Status badge (Active = green pill, Finished = grey, Setup = yellow)

---

## `/t/[id]` — Public Tournament View

### Header
```
┌──────────────────────────────────────────┐
│  ● LIVE                                  │
│  [Tournament Name]                       │
│  Matchday 3 · Stadium Name               │
│                    [WhatsApp] [QR code]  │
└──────────────────────────────────────────┘
```
- Dark background (`#0e1a12`), white text.
- Live badge: green pulsing dot + "LIVE" label — only shown when a match is live.
- WhatsApp and QR buttons are icon buttons (rounded, border, white icon).

### Tab Strip (sticky)
```
[ Live ]  [ Fixtures ]  [ Standings ]  [ Bracket ]  [ Teams ]
          ─────────── ← sliding green underline indicator
```
- Sticky below header (top: 57px).
- Dark translucent background with `backdrop-filter: blur`.
- Active tab: bold, white. Inactive: slate-400.
- Bracket tab hidden for round-robin tournaments.

### Hero — Live Match
```
┌──────────────────────────────────────────────┐
│  ● Live · Matchday 3        Group A · Pitch 1 │
│                                               │
│  [Crest]  Manchester Utd    [Crest]  Arsenal  │
│  Form: W W D L W            Form: W L W D W  │
│                                               │
│       3          —          1                │  ← large animated scoreboard
│                                               │
│  67'  1H                                      │  ← live clock
│                                               │
│  Rashford 23'   Saka 41'                      │  ← goal scorers
│  Fernandes 55'                                │
└──────────────────────────────────────────────┘
```
- Score numbers: large (≈72px), bold, white, with a subtle shimmer animation on change.
- Match clock: counts up from `match_started_at`. Period label: 1H / 2H / HT.
- Goal scorer lines: left-aligned under home team, right-aligned under away team.
- Form strip: 5 coloured dots (W=green, D=grey, L=red), most recent rightmost.

### Event Ticker
```
⚽ 67'  Man Utd vs Arsenal  Rashford fires from distance. 3–1  |  🟨 42'  ...
```
- Single horizontal scrolling row, dark background, white/green text.
- Loops continuously. Items separated by `|`.
- Goal icon (⚽), card icon (🟨/🟥), or custom SVG icons from the design system.

### Match Card (Fixtures Section)

**Scheduled:**
```
┌───────────────────────────────────────┐
│  19:00              Group A · Pitch 2  │
│  Chelsea ——— 0 : 0 ——— Liverpool      │
│                   Upcoming             │
└───────────────────────────────────────┘
```

**Live:**
```
┌───────────────────────────────────────┐
│  ● 67'              Group A · Pitch 1  │
│  Man Utd ─── 3 : 1 ─── Arsenal       │
│                   ● Live              │
└───────────────────────────────────────┘
```
- Border-left: green line for live matches.
- Score numbers in white, bold.
- Live badge: animated green dot.

**Finished:**
```
┌───────────────────────────────────────┐
│  FT                 Group A · Pitch 3  │
│  PSG ─── 2 : 0 ─── Man City          │
│                    Full time           │
└───────────────────────────────────────┘
```
- Muted, no border accent.

### Standings Card (Round-robin)
```
┌─────────────────────────────────────────────────────────────┐
│  Group A            After 2 of 3 matchdays played           │
│─────────────────────────────────────────────────────────────│
│  #  Team           P   W  D  L  GF  GA  GD   Pts  [bar]   │
│  1  Man Utd        4   3  1  0   8   2   6    10   ████░   │ ← advance arrow ➤
│  2  Arsenal        4   2  1  1   5   4   1     7   ███░░   │ ← advance arrow ➤
│  3  Chelsea        4   1  0  3   3   6  -3     3   █░░░░   │
│  4  Liverpool      4   0  0  4   1   9  -8     0   ░░░░░   │
└─────────────────────────────────────────────────────────────┘
```
- Top 2 rows: green left border + ➤ icon indicating advancement.
- Points bar: proportional fill, green, right-aligned column.
- Column widths: Team column is flexible; numeric columns are fixed-width and right-aligned.

### Team Card (Teams Section)

**Collapsed:**
```
┌──────────────────────────────────────────┐
│  [Crest]  Manchester Utd  Group A  11 pl │
│                                        ▼ │
└──────────────────────────────────────────┘
```

**Expanded:**
```
┌──────────────────────────────────────────┐
│  [Crest]  Manchester Utd  Group A  11 pl │
│                                        ▲ │
│  W: 3  D: 1  L: 0  GD: +6  Pts: 10     │
│──────────────────────────────────────────│
│  #   Name              Pos    Goals      │
│   7  Rashford          FW       2        │
│   8  Fernandes         MF       1        │
│  ...                                     │
└──────────────────────────────────────────┘
```
- Expansion is an accordion (in-place, no navigation).
- Stats strip: grey text, small, single row.

### Bracket Section (Phase 2)
```
QF               SF               Final
[Team A] 2       
           ─→   [Team A] 1       
[Team B] 0                        
                           ─→    [Team A] ★
[Team C] 3       
           ─→   [Team C] 2       
[Team D] 1       
```
- TBD slots: dashed border, "Awaiting winner" label, empty crest placeholder.
- Champion slot: gold star badge.
- Toggle button: "Bracket view" ↔ "List view" (top-right of section).

---

## `/t/[id]/team/[teamId]` — Team Roster Page

```
┌──────────────────────────────────────┐
│  ← Back to tournament               │
│                                      │
│  [Crest]  Manchester Utd  Group A   │
│                                      │
│  W: 3  D: 1  L: 0  GD: +6  Pts: 10 │
│                                      │
│  #    Name          Position  Goals  │
│   7   Rashford      FW           2  │
│   8   Fernandes     MF           1  │
│  ...                                 │
└──────────────────────────────────────┘
```
- Same dark colour scheme as `/t/[id]`.
- Back link: top-left, small, slate-400 text.

---

## `/admin/login` + `/score/login` — Login

```
┌──────────────────────────────────────┐  (dark bg #0f172a)
│                                      │
│        ⚽ Tournament Admin           │  ← white, centered
│                                      │
│  ┌──────────────────────────────┐   │
│  │  Sign in               white │   │
│  │  card                        │   │
│  │  Email  [_________________]  │   │
│  │  Password [______________]   │   │
│  │                              │   │
│  │  [! Error message here     ] │   │  ← red bg box, only on error
│  │                              │   │
│  │  [     Sign in →           ] │   │  ← green-600 button, full width
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```
- `/admin/login`: white card on dark navy.
- `/score/login`: same layout, same dark background.
- Error state: red-tinted box with border inside the card, below the fields.
- Loading state: button text → "Signing in…", button disabled.

---

## `/change-password` — Forced Password Change

```
┌──────────────────────────────────────┐  (dark bg)
│                                      │
│       Set a new password             │
│                                      │
│  ┌──────────────────────────────┐   │
│  │  New password [___________]  │   │
│  │  Confirm     [___________]   │   │
│  │                              │   │
│  │  [! Passwords must match   ] │   │  ← inline error
│  │                              │   │
│  │  [     Set Password →      ] │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

---

## `/score` — Scorekeeper Screen

```
┌────────────────────────────────────────┐  (dark bg #0f172a)
│  scorekeeper@club.com    [Sign out]    │  ← header bar
├────────────────────────────────────────┤
│  Your matches (multiple assigned)     │
│  [ Man Utd vs Arsenal  ● Live ]       │  ← selected, green bg
│  [ Chelsea vs Liverpool        ]       │
├────────────────────────────────────────┤
│                                        │
│         Man Utd     vs     Arsenal     │
│         ● Live                         │
│                                        │
│    [−]   3   [+]      [−]   1   [+]   │  ← score steppers
│     Home score          Away score     │
│                                        │
│    (saves automatically on each press) │
│                                        │
└────────────────────────────────────────┘
```
- Background: `#0f172a` (dark navy).
- Score steppers: large tap targets, rounded buttons, white numerals.
- − button disabled at 0. All controls disabled if match is not `live`.
- "Saves automatically" label is small, slate-400, below the steppers.

**Empty state:**
```
│                                        │
│    No matches assigned to you yet.    │
│                                        │
```

---

## `/admin` — Dashboard

```
┌─────────────────────────────────────────────┐  (slate-100 bg)
│  Tournament Admin   [User Management]  [out] │  ← header bar, white bg
├─────────────────────────────────────────────┤
│                                             │
│  Your Tournaments         [+ New Tournament]│
│  ┌────────────────────────────────────────┐ │
│  │  Summer Cup 2026   Round-robin  Active  │ │
│  │  1 May – 15 May · Stadium North        │ │
│  └────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────┐ │
│  │  ...                                   │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```
- shadcn/ui components throughout `/admin`.
- Status badges: Setup = yellow, Active = green, Finished = grey, Archived = slate.
- "+ New Tournament" button: top-right of the list heading.

---

## `/admin/tournaments/[id]` — Tournament Detail

```
┌────────────────────────────────────────────────────┐
│  ← Dashboard    Summer Cup 2026     ● Active       │
├────────────────────────────────────────────────────┤
│  [4 Teams]  [6 Matches]  [3 Played]  [3 Remaining]│  ← stat cards row
├────────────────────────────────────────────────────┤
│  Match list                                        │
│  ┌──────────────────────────────────────────────┐ │
│  │  19:00  Man Utd vs Arsenal   —:—  Scheduled  │ │  ← [Start Match] btn
│  │  20:30  Chelsea vs Liverpool  3:1  Live       │ │  ← [End Match] btn
│  │  18:00  PSG vs Man City       2:0  Finished   │ │  ← [Revert to Live] (admin)
│  └──────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────┤
│  [Teams & Rosters]  [Fixtures]  [Scorekeepers]     │  ← nav links
└────────────────────────────────────────────────────┘
```

### Match Status Controls (`MatchStatusControls.tsx`)
- **Scheduled row**: "Start Match" button (green).
- **Live row**: score shown, "End Match" button (slate/grey).
- **Finished row**: "Revert to Live" button (red, Admin only). Logs to `admin_audit_log`.
- All buttons show a spinner while the request is in flight.

---

## `/admin/tournaments/[id]/teams` — Teams & Rosters

```
┌────────────────────────────────────────────────┐
│  ← Tournament    Teams & Rosters               │
├────────────────────────────────────────────────┤
│  Add Team                                      │
│  [Team name ___________________________] [Add] │
│  (disabled when any match is live)             │
├────────────────────────────────────────────────┤
│  ▼  Manchester Utd  (11 players)               │
│     # · Name         · Position  [Delete]      │
│     7 · Rashford     · FW        [×]           │
│     ────────────────────────────────────────   │
│     Add player: [Name] [#] [Position] [Add]    │
│  ─────────────────────────────────────────     │
│  ▶  Arsenal  (9 players)                       │
└────────────────────────────────────────────────┘
```
- Delete player buttons disabled once any match for that team is `live`.
- "Add Player" inline form appears at the bottom of each expanded team.

---

## `/admin/tournaments/[id]/fixtures` — Fixtures

```
┌──────────────────────────────────────────────────────┐
│  ← Tournament    Fixtures                            │
├──────────────────────────────────────────────────────┤
│  Schedule a match                                    │
│  Home [dropdown▼]  Away [dropdown▼]  [Date + time]  │
│  [Schedule Match]                                    │
├──────────────────────────────────────────────────────┤
│  All Matches                                         │
│  19:00  Man Utd vs Arsenal   Scheduled  [Delete]    │
│  20:30  Chelsea vs Liverpool   Live      —           │  ← delete disabled
│  18:00  PSG vs Man City      Finished    —           │  ← delete disabled
└──────────────────────────────────────────────────────┘
```

---

## `/admin/tournaments/[id]/scorekeepers` — Scorekeeper Assignment

```
┌──────────────────────────────────────────────────────┐
│  ← Tournament    Scorekeepers                        │
├──────────────────────────────────────────────────────┤
│  Assign Scorekeeper                                  │
│  Email [_______________________]                     │
│  Scope: (●) Entire tournament  ( ) Specific match   │
│  Match: [dropdown — only if Specific match ▼]        │
│  [Assign]                                            │
├──────────────────────────────────────────────────────┤
│  Current Assignments                                 │
│  scorer@club.com  · Tournament-wide     [Remove]    │
│  ref2@club.com    · Man Utd vs Arsenal  [Remove]    │
└──────────────────────────────────────────────────────┘
```

---

## `/admin/users` — User Management

```
┌──────────────────────────────────────────────┐
│  ← Dashboard    User Management              │
├──────────────────────────────────────────────┤
│  Add User                                    │
│  Create an account with the default password.│
│  Share credentials with the user directly.   │
│  [+ Add User]                               │
├──────────────────────────────────────────────┤
│  All Users (5)                               │
│  president@club.com   [admin] [organizer]    │
│  scorer1@club.com     [scorekeeper]          │
│  newuser@club.com     No roles               │
└──────────────────────────────────────────────┘
```
- Role pills: admin = purple, organizer = blue, scorekeeper = green.
- "No roles" shown in slate-400.

---

## `/admin/users/invite` — Create Account

```
┌──────────────────────────────────────────────┐
│  ← Users    Add User                         │
├──────────────────────────────────────────────┤
│  Email  [_____________________________]      │
│                                              │
│  Role:                                       │
│  (●) Organizer                               │
│      Manages tournaments, fixtures, rosters  │
│  ( ) Scorekeeper                             │
│      Enters live match scores only           │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ ℹ Account will be created with       │   │
│  │   default password: footballclub     │   │
│  │   User must change it on first login.│   │
│  └──────────────────────────────────────┘   │
│                                              │
│  [Create Account]                            │
│                                              │
│  ✓ Account created for scorer@club.com.      │  ← success toast (top-right)
│    Default password: footballclub            │
└──────────────────────────────────────────────┘
```

---

## Toast Component

Used in `/admin` and `/score`.

```
  ┌──────────────────────────────────────────┐   ← top-right, fixed
  │  ✓  Account created for scorer@club.com  │
  └──────────────────────────────────────────┘
```
- Appears in top-right corner, fixed position.
- Auto-dismisses after ~3 seconds.
- Success: green border/icon. Error: red border/icon.
- Not used on the public participant view.

---

## LiveBadge Component

```
  ● LIVE
```
- Green pulsing dot (`animate-pulse`) + "LIVE" text.
- Used in: tournament header, match cards, scorekeeper screen.
- Dot animation uses CSS keyframes: opacity 1 → 0.3 → 1, 1.5s loop.
