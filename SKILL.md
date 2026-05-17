# PITCH Design System — SKILL.md

> Portable manifest for the PITCH football tournament design system. Read this before producing any visual artifact. Compatible with Claude Code and other agents.

## What you're working in

**Brand:** PITCH (PitchSide Football Management). Voice = sports broadcaster, allergic to fluff.
**Product:** Mobile-first PWA for football tournament scoring, scheduling, and sharing — for club admins, tournament organizers, scorekeepers, and fans.
**Aesthetic:** Stadium at night meets broadcast graphics. Pitch black, electric lime, condensed display caps, tabular numerics, line-art UI icons + colorful sport icons.

## Tokens — `colors_and_type.css`

`colors_and_type.css` at the project root is the single source of truth. **Always import it; never re-declare.** It exposes:

- **Color** — brand pair (`--brand-pitch #0E1A12`, `--brand-lime #A3E635`, `--brand-chalk #F4F7EE`); a 50–900 *grass* scale (lime → deep green); a 0–900 *ink* (pitch neutrals) scale; semantic match-event hooks (`--goal`, `--foul`, `--red-card`, `--penalty`, `--info`); a curated 8-swatch *team jersey* palette; surface aliases (`--bg`, `--surface`, `--fg`, `--fg-muted`, `--border`) that flip via `[data-theme="dark"]`.
- **Type** — Display = **Archivo Narrow** (700/800/900, condensed, uppercase, `letter-spacing: -0.02em`). Body = **Archivo** (400–700). Mono = **JetBrains Mono**. Three families, three jobs — don't bring more in.
- **Sizes** — clamp-scaled (`--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-small`, `--fs-micro`) plus a giant `--fs-score` for scoreboards.
- **Spacing** — 4px scale, `--space-1` … `--space-20`.
- **Radii** — `--radius-sm` 6, `-md` 12, `-lg` 18, `-xl` 24, `-pill` 999.
- **Shadows** — sm/md/lg warm-tinted with pitch-black, plus `--shadow-glow` (lime focus ring) and `--shadow-press` (inset).
- **Motion** — three durations (fast 120 / base 220 / slow 420); three easings (`--ease-out` default; `--ease-in-out`; `--ease-bounce` for goal celebrations *only*); ~12 named animations (`pitchPulse`, `limePulse`, `tickIn`, `shoutIn`, `barGrow`, `marquee`, `ballSpin`, `confetti`, `shimmer`, etc.). `prefers-reduced-motion` is honored.

**Dark mode is the canonical mode.** Light tokens exist; the brand reads as itself in dark.

## Voice & content

- **Display copy is UPPERCASE.** Headers, eyebrows, tabs, chips, button labels, status badges. This is the scoreboard feel — commit to it.
- **Body is sentence case.** Form labels, helper text, microcopy.
- **Setup/admin mode** is plain second-person and instructive. *"Add at least 2 teams before scheduling fixtures."*
- **Lock copy is procedural, never punitive.** 🔒 + one-line reason. *"Locked — first match has been scheduled."*
- **Numbers** use tabular-nums (`.tnum` / `font-variant-numeric: tabular-nums`). Scores are `2 – 1` (en-dash, hair spacing). Match minutes use an apostrophe: `67'`. Times are 24-hour by default.
- **No emoji.** The single sanctioned glyph is the inline 🔒 in lock helper text.
- **No filler content.** If a section feels empty, that's a layout problem, not a copy problem.

## Components — quick reference

- **Match card** — left status rail (3px): gray default, lime upcoming, **red live (1.6s pulse)**, muted FT. Two team rows, tabular score on the right. Pill-shaped corners, `--ink-800` background, `--ink-700` border.
- **Tournament status badge** — Setup (sky), Active (lime), Finished (gray), Archived (gray dashed), Live (red, pulsing dot).
- **Standings table** — qualify rows have a left-to-right lime tint + lime rank/pts. Tabular nums everywhere. P / W / D / L / GD / Pts (drop W/D/L on mobile).
- **Bracket** — vertical stack on mobile, columns on desktop. Winner row is lime-tinted. Trophy cell at the end with lime border + glow.
- **Buttons** — pill (`--radius-pill`). Primary = lime fill / pitch text. Secondary = ink-800 surface. Ghost = transparent. Danger = red-tinted. `:active` is `scale(0.98)` (no color shift). Focus = `--shadow-glow` lime ring.
- **Filter chip** — pill, uppercase 11px display, `aria-pressed` flips fill to lime.
- **Lock indicator** — dashed-border input, dim text, helper line: `🔒 Locked — <reason>.`
- **FAB** — lime pill bottom-right, lime ring shadow + warm-dark drop. Only on tabs that need a primary CTA (e.g. Fixtures → "Schedule match").
- **Live shell** — red-tinted hero with floodlight radial gradient + pitch-stripe overlay; giant scoreboard nums (`--fs-score`); live pill + period-aware clock (`2H 67:12`); event log of goal/yellow/red rows.

## Iconography rule

- **Sport-specific events** (goal, card, whistle, jersey, trophy) → use the SVGs in `assets/`. They are intentionally colorful (lime ball, amber yellow card, red red-card) — don't recolor them to monochrome.
- **Generic UI** (search, share, plus, arrow, chevron, lock, settings, edit, calendar) → inline `<svg>` line-art at 14–24px, `stroke-width: 2.5`, `stroke-linecap: round`, `stroke-linejoin: round`, `fill: none`, `stroke: currentColor`. This style matches **Lucide** — pull from `https://unpkg.com/lucide-static@latest/icons/<name>.svg` if a glyph isn't already in the codebase. No filled / glyph icons.

## Layout & chrome

- Mobile design width **430px**. Container max **1240px** desktop with 28px gutters.
- Sticky top nav (~65px) + sticky tab strip (~56px) — both `rgba(14,26,18, 0.92)` + `backdrop-filter: blur(14px)`. The only place blur is allowed.
- Hero backgrounds layer a soft lime radial glow + a 60px pitch-stripe `repeating-linear-gradient`. Never literal stadium photos.
- Sections vary tone via `rgba(0,0,0,0.18–0.22)` overlays on dark, never different colors.
- Card padding is 16–20px mobile / 20–24px laptop. Vertical rhythm between sections is generous (56–88px).

## What to do (and not do)

✅ **Do**
- Import `colors_and_type.css` and use the variables.
- Lead CTAs with one verb: *"Start match"*, *"Half time"*, *"Mark tournament as finished"*.
- Write live commentary in the present tense, one shot of information per line.
- Use tabular nums on every score, stat, clock, table cell.
- Use Lucide line-art for any icon not already in `assets/`.
- Keep dark mode as the default canvas.

❌ **Don't**
- Don't introduce new fonts. Three families is the system.
- Don't add emoji (except the inline 🔒 lock glyph paired with text).
- Don't use filled / glyph / Material-style icons.
- Don't gray a control silently — locked state always carries a one-line reason.
- Don't pad designs with filler stats, decorative icons, or "data slop". Every element earns its place.
- Don't draw new logos by hand. Use `assets/logo-mark.svg` / `assets/logo-wordmark-dark.svg`.
- Don't use AI/photo backgrounds. The brand is line-art + iconography.

## Files in this project

```
README.md                  ← long-form design system narrative
SKILL.md                   ← this file
colors_and_type.css        ← tokens
assets/                    ← logos, sport icons, illustrations, turf pattern
preview/                   ← Design System tab cards (don't ship; reference only)
ui_kits/admin/             ← interactive prototype: 7-tab Tournament Detail + Live screen
reference/                 ← original codebase, source of truth for visual language
```

## Caveats

- Fonts load from Google Fonts via `@import` at the top of `colors_and_type.css`. Self-host for production.
- Logos are placeholder-quality stadium-marks. Swap in production logos when available.
- No marketing-site, deck, or email templates exist — out of scope.
