# PITCH — Design System

**Brand:** PITCH (PitchSide Football Management)
**Product:** Football tournament scoring, scheduling & sharing — used by club admins, tournament organizers, scorekeepers, and participants/fans.
**Primary surface:** Mobile-first PWA. Dashboard-style admin/organizer surface (`/admin/*`) is the system's home.
**Identity in one line:** *Stadium at night meets sports broadcaster.* Pitch black + electric lime, condensed display type, tabular numerals, and animated live-data flourishes that make a small intramural cup feel like the Premier League.

---

## Sources

This design system was extracted from a complete reference codebase the user provided:

- `reference/Live Tournament.html` — fully wired participant view (entry HTML)
- `reference/app.jsx`, `reference/components-core.jsx`, `reference/components-sections.jsx`, `reference/components-bracket.jsx` — the React component surface
- `reference/styles.css` — page styles
- `reference/data.js` — mock tournament data ("Eastside University Cup")
- `colors_and_type.css` — the design tokens file (CSS custom props for color, type, spacing, radii, shadow, motion)
- `assets/` — logos, sport iconography (ball, jersey, whistle, cards, trophy), illustrations (pitch, stadium), and a turf SVG pattern

The product spec (UX) lives outside this repo:
- *PitchSide — UX Spec: Admin & Organizer Dashboard* (2026-05-07 draft) — defines the 7-tab tournament detail surface, status state machine, and lock indicators that this DS supports.

> If you have view access to the original codebase, the source of truth for component behavior is `reference/`. Everything in `ui_kits/` is a static recreation that follows the same visual language.

---

## Index

```
PITCH Design System/
├── README.md                  ← you are here
├── SKILL.md                   ← portable skill manifest (Claude Code compatible)
├── colors_and_type.css        ← single source of truth for tokens (color / type / space / radii / shadow / motion)
├── assets/                    ← logos, icons, illustrations (all SVG)
│   ├── logo-mark.svg
│   ├── logo-wordmark-dark.svg
│   ├── icon-ball.svg
│   ├── icon-jersey.svg
│   ├── icon-whistle.svg
│   ├── icon-trophy.svg
│   ├── icon-yellow-card.svg
│   ├── icon-red-card.svg
│   ├── illust-pitch.svg
│   ├── illust-stadium.svg
│   └── pattern-turf.svg
├── preview/                   ← Design System tab cards (rendered by the Design System tab)
├── ui_kits/
│   └── admin/                 ← Mobile-first admin/organizer dashboard (the spec's main surface)
│       ├── README.md
│       ├── index.html         ← interactive click-thru: 7-tab tournament detail
│       └── *.jsx              ← shell, tabs, fixtures, standings, bracket, etc.
└── reference/                 ← original uploaded codebase (read-only; truth for visual language)
```

---

## Content fundamentals

PITCH writes like a confident sports broadcaster who respects the volunteer organizer. Short sentences. Verbs over nouns. Numbers up front. Never apologetic, never cute, never preachy.

**Voice & tone**
- **Setup / admin mode:** plain, instructive, second-person. *"Add at least 2 teams before scheduling fixtures."* / *"Locked — first match has been scheduled."* / *"Tournament is in **Setup**. It becomes **Active** when the first match goes live."*
- **Empty states never apologize.** They tell you what's missing and the next move: *"No teams yet. Add at least 2 teams before scheduling fixtures."*
- **Lock copy is procedural, not punitive.** Never *"You can't edit this"*. Always *"Locked — tournament is active."* The lock icon (🔒) plus a one-line reason is the canonical pattern.

**Casing**
- **Display type is UPPERCASE.** All h1 / h2 / .section-title / .eyebrow / nav tabs / chips / button labels in display family render in caps. This is the "scoreboard" feel — stop fighting it.
- **Sentence case for body, microcopy, and form labels.** *"Schedule match"*, *"No goals yet"*, *"Top 2 advance"*.
- **Title Case is rare** — only proper nouns ("Eastside University Cup"), match labels ("Group A · Matchday 9"), or league-style format names ("Round Robin + Knockout").

**Pronouns & address**
- **You / your** for the organizer. Never *"we"* (the product is a tool, not a partner).
- Action verbs lead CTAs: *"Start match"*, *"Half time"*, *"Mark tournament as finished"*, *"Assign scorekeeper"*. Avoid noun-phrase buttons (*"Match start"*) — this is a sport.

**Numbers**
- **Tabular numerals everywhere a number lives** (`font-variant-numeric: tabular-nums` is set on `.tnum`, `.score`, scoreboard digits, standings table). Scores never wiggle when they tick.
- Scores use an **en-dash separator** with hair spacing: `2 – 1`, never `2-1` and never `2:1`.
- Match minutes use an apostrophe: `67'`. Match times use 24-hour by default (`19:30`) — the data is ambiguous-locale-friendly.
- Player names render `F. Lastname` in dense lists, `Firstname Lastname` in roster/profile.

**Vocabulary (use this, not that)**
- *Fixtures* (not "matches list"), *Standings* (not "leaderboard"), *Bracket* (not "playoff tree"), *Scorers* (not "goal stats"), *Scorekeeper* (not "referee" — the ref is in-game; the scorekeeper logs goals).
- *Setup / Active / Finished / Archived* — the four tournament statuses, capitalized in copy when referring to the state.
- *Group A* / *Matchday 9* / *QF / SF / Final* — broadcast shorthand, used freely.

**Emoji?** No. The brand has its own iconography (ball, whistle, cards, trophy). The single sanctioned emoji-ish glyph is the lock icon (🔒) used inline in lock-state helper text — and even that is paired with text.

**Vibe summary:** Confident, broadcast-y, allergic to fluff. If a sentence could be deleted, delete it. If a button label could be one verb, make it one verb.

---

## Visual foundations

**Color**
The system is **dark-mode-first**: `--ink-900` `#0E1A12` ("deep grass at night") is the canonical background. Light mode exists (`--bg: #FAFBF5`) but the brand reads as itself in dark.

- **Brand pair:** Pitch black `#0E1A12` + Electric lime `#A3E635`. The lime is the *only* accent that matters — it carries CTAs, active tab indicators, qualify-rows in standings, top-scorer rank, the trophy-cell glow, the live tab-indicator shadow.
- **Grass scale (50→900):** the lime sits at 300; deeper greens (700–900) become surface tints in the bracket and live shell.
- **Pitch neutrals (ink-0→900):** warm-cool darks. `ink-700`/`800` are surface elevations; `ink-300`/`400` are muted text.
- **Match-event semantics:** `--goal: #A3E635`, `--foul: #F59E0B` (yellow card), `--red-card: #DC2626`, `--penalty: #FB923C`, `--info: #38BDF8`.
- **Live-state pulse uses red** (`#DC2626`) — same hex as the red card, intentionally; "live" and "danger" share the same broadcast urgency.
- **Team jersey palette** is curated (8 swatches) — used for crests/avatars so any team gets a distinguishable color without hand-tuning.

**Typography**
- **Display:** Archivo Narrow (700/800/900). Condensed, uppercase, `letter-spacing: -0.02em`, `font-stretch: 75%`. This is the scoreboard, the section titles, the team names, the chips, the tabs. If it's bold and uppercase, it's Archivo Narrow.
- **Body:** Archivo (400/500/600/700). Neutral, readable, sentence-case.
- **Mono:** JetBrains Mono — used for clock (`67:12`), match minutes (`12'`), kbd-style chips, "last updated" indicators.
- **Numerics:** `font-variant-numeric: tabular-nums` is mandatory on any score, standings cell, or stat. Scores use a clamp-scaled `--fs-score` up to `120px`.
- **Three sizes you actually use:** giant scoreboard (`--fs-score`), uppercase display headers (`--fs-h1`/`h2`), 14–16px body. The middle is sparse on purpose.

**Spacing & layout**
- 4px base scale (`--space-1` … `--space-20`). Most card padding is `16–20px` (mobile) / `20–24px` (laptop). Generous vertical rhythm between sections (`88px 0 72px` on desktop, `56px 0 40px` on mobile).
- **Container max:** 1240px with 28px gutters (18px on mobile).
- **Mobile design width:** 430px. Tabs become a horizontal-scroll strip; tables hide secondary columns rather than truncate.

**Backgrounds & textures**
- The **hero** ships two stacked backgrounds: a soft lime radial-gradient glow from top-center, plus a subtle 60px-pitch-stripe `repeating-linear-gradient` overlay. Together they evoke a stadium under floodlights without ever being literal.
- **Section variation** is achieved with `rgba(0,0,0,0.18)`/`0.22` overlays on dark sections — never different colors.
- A **turf SVG pattern** (`assets/pattern-turf.svg`) exists for atmosphere on hero/empty states; never on dense data surfaces.
- **No photos**, **no full-bleed imagery**, **no AI-generated visuals**. The pitch and stadium illustrations are the only large graphics.

**Borders, radii, shadows**
- **Borders:** `1.5px` default (`--border-width`), `3px` ("bold sport outline") for emphasis. Border colors are `--ink-700` on dark, `--ink-200` on light.
- **Radii:** 6 (sm) / 12 (md) / 18 (lg) / 24 (xl) / 999 (pill). Pill radius is heavy in this system — chips, buttons, status badges, crests, the live-pill, even score-tick wrappers all pill out.
- **Shadows are warm-dark** and tinted with `rgba(14,26,18, …)` (the pitch black). Three levels (sm / md / lg) plus two specials: `--shadow-glow` (a 4px lime ring used on focus and on live states) and `--shadow-press` (an inset top shadow used on pressed buttons).
- **Cards** sit on `--ink-800` (dark) / `--bg-elev #FFFFFF` (light), with `1px solid --ink-700`/`--ink-200`, `--radius-lg` (18px), and **a 3px left accent rail** that flips color by status: gray (default) → lime (upcoming) → red (`live`) → muted (`ft`). The rail is the system's primary status signal in lists.

**Motion**
- **Three durations:** fast `120ms` / base `220ms` / slow `420ms`. Long-form reveals use 600–700ms.
- **Three easings:**
  - `--ease-out` (`cubic-bezier(0.22, 1, 0.36, 1)`) — default.
  - `--ease-in-out` for symmetric transitions.
  - `--ease-bounce` (`cubic-bezier(0.34, 1.56, 0.64, 1)`) — **only for goal celebrations** (toast pop, score tick).
- **Named animations:** `pitchPulse` (red live-dot), `limePulse` (lime focus ring), `tickIn` / `tickOut` (score digits flip), `slideUp` / `slideRight` (reveal-on-scroll), `shoutIn` / `shoutOut` (GOAL! toast), `barGrow` (standings points bar), `marquee` (event ticker), `ballSpin` (clock ball), `confetti` (goal celebration), `shimmer` (loading).
- **Reveal-on-scroll** is intentional: cards fade-and-rise 28px on first viewport entry; standings points bars grow from 0 → max-pts. Reveals fire once.
- **`prefers-reduced-motion`** is honored — every animation collapses to ~0.01ms.

**Interaction states**
- **Hover:** card `transform: translateY(-2px)` (or `-3px` on match cards), border tint to `--ink-500`. List rows: `translateX(4px)` and a subtle background lift. The arrow-circle on a match card swaps to lime fill on parent hover.
- **Active / press:** `transform: scale(0.98)` for buttons; `inset` press shadow on pill buttons. No color shift — just the squish.
- **Focus:** `--shadow-glow` (lime ring) — visible on dark and light, never invisible.
- **Disabled / locked:** retain label and value, dim to `--ink-400`/`--ink-500`, prepend or append a 🔒 + one-line reason in `--fg-muted`. Never gray a control silently.
- **"Live" state:** red 1.6s pulsing dot, red tinted border (`rgba(220,38,38,0.4)`), red rail on match cards. The lime accent sits *next* to live red, never behind it.

**Transparency & blur**
- Sticky chrome (top nav, tab strip) uses `rgba(14,26,18, 0.78–0.92)` + `backdrop-filter: blur(14px)`. This is the only place blur is used.
- No frosted-glass cards, no glass dividers — the brand is solid, not airy.

**Layout rules**
- **Sticky top nav** (65px), with a **sticky tab strip** (sub-nav, 56px) directly underneath. Together they form a 110–120px chrome.
- **Page widths:** 1240px container, with section-level grids that reflow to single column at ≤720px.
- **Tabs are role-aware, not role-separated.** The same Tournament Detail surface serves Admin and Organizer; what differs is which actions are exposed.
- **Match-day flow lives on Fixtures.** Setup-day flow lives on Overview/Teams. Tabs read left-to-right as the tournament's lifecycle.

---

## Iconography

**The set.** PITCH ships its own minimal sport-icon set as flat SVGs in `assets/`:

| File | Use |
|---|---|
| `icon-ball.svg` | Goal events, match clock companion (spins on `ballSpin`) |
| `icon-jersey.svg` | Team / roster contexts |
| `icon-whistle.svg` | Referee, kickoff, official actions |
| `icon-trophy.svg` | Champion cell, awards |
| `icon-yellow-card.svg` | Yellow card events (also used inline in ticker as a yellow rounded rect) |
| `icon-red-card.svg` | Red card events |
| `illust-pitch.svg` | Empty-state illustration of a football pitch |
| `illust-stadium.svg` | Larger atmospheric illustration |
| `pattern-turf.svg` | Tile-able turf texture |

Use these whenever the action is **about football itself** — goals, cards, kickoff, trophy. They are colorful (lime ball, amber card, red card) and intentionally not monochromatic; they are part of the brand palette.

**Generic UI iconography is line-art.** For everything that isn't sport-specific (search, share, plus, arrow-right, chevrons, edit, lock, ellipsis, calendar, clock, filter, settings, user) the system uses **inline `<svg>` line icons at 14–24px, `stroke-width: 2.5`, `stroke-linecap: round`, `stroke-linejoin: round`, `fill: none`, `stroke: currentColor`**. This style is established directly in `components-core.jsx` and `components-sections.jsx` (search/share/plus/arrow are all hand-rolled in this style).

That style is the same line-art system **Lucide** ships, so when a needed icon is missing from the codebase the substitution rule is: **pull from Lucide via CDN** (`https://unpkg.com/lucide-static@latest/icons/<name>.svg`) at the same stroke-width, no edits. We treat Lucide as the canonical extension of PITCH's hand-rolled set.

**Emoji.** Not part of the brand. The single exception is the inline 🔒 used in lock-state helper text where a glyph helps scanning ("🔒 Locked — tournament is active.") — paired with text, never alone, never as a button.

**Unicode glyphs.** Only the en-dash `–` (in scores `2 – 1`), the apostrophe `'` (in match minutes `67'`), and the middot `·` (as a meta separator: *"Group A · Matchday 9 · North Field"*).

**Don't.**
- Don't draw new mascot/logo SVGs by hand. Copy from `assets/` or commission.
- Don't use filled / glyph icons (Heroicons solid, Material filled). The brand is line-art, not slab.
- Don't render flag/country icons unless we ship them — the brand is club-scale, not international.

---

## What's deliberately not in this system

- **Slide deck templates** — none provided in the source codebase, none generated.
- **Email templates** — out of scope for the current brief.
- **Marketing site** — out of scope; brief was admin-dashboard PWA only.
- **Light-mode styling for marketing pages** — light tokens exist (`--bg: #FAFBF5` etc.) but no light-mode UI was authored. The brand reads dark-mode by default.

---

## Caveats / open items

- **Fonts** load from Google Fonts via the `@import` at the top of `colors_and_type.css`. No `.ttf`/`.woff` files are bundled. If you need offline / production-grade hosting, download Archivo, Archivo Narrow, and JetBrains Mono from Google Fonts and self-host.
- **Logo**: simple stadium-mark wordmark provided. If the user has a real production logo it should replace `assets/logo-mark.svg` and `assets/logo-wordmark-dark.svg`.
- **No screenshots** of the production app exist in the source; the UI kit is a recreation faithful to the reference codebase, not pixel-traced from a live deployment.
