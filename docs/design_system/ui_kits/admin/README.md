# PITCH Admin · Mobile UI Kit

A working interactive prototype of the **Tournament Detail** surface from *PitchSide — UX Spec: Admin & Organizer Dashboard*.

**Open:** `index.html` (designed at 430×932 — iPhone 14 Pro)

## What it covers

The 7-tab Tournament Detail surface for the **Eastside University Cup** (mock tournament, status: Active):

1. **Overview** — today's fixtures, group standings, top scorers
2. **Fixtures** — filter chips, day-grouped match cards, FAB to schedule
3. **Standings** — both groups, qualify-row highlighting (top 2 advance)
4. **Bracket** — single-elimination, QF → SF → Final → Trophy cell
5. **Teams** — 2-up team-card grid with crests
6. **Scorers** — golden-boot race with player rows
7. **Settings** — locked-state form fields, destructive "Mark as finished"

Plus a **Live match detail** screen reachable from any live match card — scoreboard, clock, event log, scorekeeper actions.

## How it's wired

- `index.html` — entry, loads React + Babel + the `.jsx` files in order
- `data.jsx` — `TEAMS`, `team()`, `Crest`, `Icon` (line-art SVGs)
- `tabs.jsx` — all 7 tab content components
- `live.jsx` — live match detail screen
- `app.jsx` — root, owns screen + tab state
- `styles.css` — kit-specific layout (uses tokens from `colors_and_type.css`)

## Caveats

- **Mocked.** No real API, no scorekeeper write-back, no auth/roles toggle.
- **Mobile only.** Desktop reflow exists in `reference/styles.css` but isn't recreated here — the spec calls for mobile-first PWA.
- **Tabs are scrollable** — flick the tab strip horizontally to see *Bracket → Settings*.
- The **Schedule match** FAB only appears on the Fixtures tab; tap is a no-op (would open the match scheduler modal in production).
