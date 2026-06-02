# Shared Utils Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 7 copies of `initials()` and 1 redundant `formatMatchTime` in `HeroLive` by centralising them in `lib/format.ts`, so future changes happen in one place.

**Architecture:** `lib/format.ts` already exists as the formatting utility module — it has `formatClock`, `formatMatchTime`, `formatRange`. We add `teamInitials()` there and delete all local copies. `HeroLive`'s private `formatMatchTime` is replaced with the existing `formatClock` import.

**Tech Stack:** TypeScript, Next.js. No new dependencies. Health checks: `cd web && pnpm tsc --noEmit`.

---

## What was found and why

During a maintainability audit, two categories of duplication were identified:

### 1. `initials(name: string)` — 7 identical copies

Same function body copy-pasted into:

| File | Type |
|---|---|
| `components/HeroLive.tsx` | public component |
| `components/MatchCard.tsx` | public component |
| `components/BracketView.tsx` | public component |
| `components/TeamCard.tsx` | inline (not a named function) |
| `components/admin/AdminBracketView.tsx` | admin component |
| `app/admin/tournaments/[id]/knockout/BracketSetupView.tsx` | admin page component |
| `app/t/[id]/team/[teamId]/page.tsx` | public page |

All 7 are identical: `name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()`

### 2. `formatMatchTime` in `HeroLive.tsx` — private copy when `formatClock` already exists

`HeroLive.tsx` defines its own:
```ts
function formatMatchTime(matchTime: string) {
  const d = new Date(matchTime)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
```

`lib/format.ts` already exports:
```ts
export function formatClock(iso: string): string {
  if (!iso) return 'TBD'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
```

Both format to HH:MM. The private copy should be deleted and `formatClock` imported.

### Out of scope (intentionally left alone)

- `computeGroupStandings` in `MatchViews.tsx` vs `lib/qualifiers.ts` — different signatures and return types; different purposes.
- `computeLeagueStandings`, `nextPowerOfTwoAtLeast`, `buildCrossPoolLabels` — only used inside `MatchViews.tsx`, no duplication.
- Time-formatting locale inconsistency (`en-MY` vs `en-US` vs `en-GB`) — design/i18n decision, not in scope.

---

## File map

| File | Change |
|---|---|
| `web/lib/format.ts` | Add `export function teamInitials(name: string): string` |
| `web/components/HeroLive.tsx` | Remove private `initials` + `formatMatchTime`; import `teamInitials`, `formatClock` |
| `web/components/MatchCard.tsx` | Remove private `initials`; import `teamInitials` |
| `web/components/BracketView.tsx` | Remove private `initials`; import `teamInitials` |
| `web/components/TeamCard.tsx` | Remove inline initials; import `teamInitials` |
| `web/components/admin/AdminBracketView.tsx` | Remove private `initials`; import `teamInitials` |
| `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx` | Remove private `initials`; import `teamInitials` |
| `web/app/t/[id]/team/[teamId]/page.tsx` | Remove private `initials`; import `teamInitials` |

---

## Task 1: Add `teamInitials` to `lib/format.ts`

**Files:**
- Modify: `web/lib/format.ts`

- [ ] **Step 1: Add the export at the bottom of `lib/format.ts`**

Open `web/lib/format.ts`. Append at the end:

```ts
export function teamInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/format.ts
git commit -m "feat: add teamInitials to lib/format.ts"
```

---

## Task 2: Update `HeroLive.tsx`

**Files:**
- Modify: `web/components/HeroLive.tsx`

- [ ] **Step 1: Replace the two private functions with imports**

At the top of `web/components/HeroLive.tsx`, the current imports are:
```ts
import { useEffect, useState } from 'react'
import { LiveBadge } from './LiveBadge'
import type { MatchWithTeams } from '@/lib/supabase/types'
```

Replace with:
```ts
import { useEffect, useState } from 'react'
import { LiveBadge } from './LiveBadge'
import { teamInitials, formatClock } from '@/lib/format'
import type { MatchWithTeams } from '@/lib/supabase/types'
```

- [ ] **Step 2: Remove the two private function definitions**

Delete these lines entirely:
```ts
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
```
and:
```ts
function formatMatchTime(matchTime: string) {
  const d = new Date(matchTime)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
```

- [ ] **Step 3: Replace all call sites within the file**

In the JSX, replace every `initials(...)` call with `teamInitials(...)`.
Replace every `formatMatchTime(match.match_time)` call with `formatClock(match.match_time)`.

There are 2 `initials()` calls (one for home team, one for away team) and 1 `formatMatchTime()` call.

- [ ] **Step 4: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/HeroLive.tsx
git commit -m "refactor: use teamInitials and formatClock from lib/format in HeroLive"
```

---

## Task 3: Update `MatchCard.tsx`

**Files:**
- Modify: `web/components/MatchCard.tsx`

- [ ] **Step 1: Add import and remove private `initials`**

Current imports at the top of `web/components/MatchCard.tsx`:
```ts
import type { MatchWithTeams } from '@/lib/supabase/types'
import { LiveBadge } from './LiveBadge'
```

Replace with:
```ts
import type { MatchWithTeams } from '@/lib/supabase/types'
import { LiveBadge } from './LiveBadge'
import { teamInitials } from '@/lib/format'
```

Then delete the private function:
```ts
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
```

- [ ] **Step 2: Replace all `initials(...)` calls with `teamInitials(...)`**

There are 2 call sites in the JSX (home team, away team).

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/MatchCard.tsx
git commit -m "refactor: use teamInitials from lib/format in MatchCard"
```

---

## Task 4: Update `BracketView.tsx`

**Files:**
- Modify: `web/components/BracketView.tsx`

- [ ] **Step 1: Add import and remove private `initials`**

Current first line of `web/components/BracketView.tsx`:
```ts
import type { MatchWithTeams } from '@/lib/supabase/types'
```

Replace with:
```ts
import { teamInitials } from '@/lib/format'
import type { MatchWithTeams } from '@/lib/supabase/types'
```

Delete the private function:
```ts
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
```

- [ ] **Step 2: Replace all `initials(...)` calls with `teamInitials(...)`**

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/BracketView.tsx
git commit -m "refactor: use teamInitials from lib/format in BracketView"
```

---

## Task 5: Update `TeamCard.tsx`

**Files:**
- Modify: `web/components/TeamCard.tsx`

- [ ] **Step 1: Add import**

`web/components/TeamCard.tsx` starts with:
```ts
import Link from 'next/link'
...
import type { Team, Player, Standing } from '@/lib/supabase/types'
```

Add to the imports:
```ts
import { teamInitials } from '@/lib/format'
```

- [ ] **Step 2: Replace the inline initials expression**

Find this line (inside the component body):
```ts
const initials = team.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
```

Replace with:
```ts
const initials = teamInitials(team.name)
```

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/TeamCard.tsx
git commit -m "refactor: use teamInitials from lib/format in TeamCard"
```

---

## Task 6: Update `AdminBracketView.tsx`

**Files:**
- Modify: `web/components/admin/AdminBracketView.tsx`

- [ ] **Step 1: Add import and remove private `initials`**

Current first import line of `web/components/admin/AdminBracketView.tsx`:
```ts
import { useMemo } from 'react'
import type { MatchWithTeams } from '@/lib/supabase/types'
```

Add:
```ts
import { teamInitials } from '@/lib/format'
```

Delete the private function (around line 40):
```ts
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
```

- [ ] **Step 2: Replace all `initials(...)` calls with `teamInitials(...)`**

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/admin/AdminBracketView.tsx
git commit -m "refactor: use teamInitials from lib/format in AdminBracketView"
```

---

## Task 7: Update `BracketSetupView.tsx`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx`

- [ ] **Step 1: Add import and remove private `initials`**

Current imports of `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx` include:
```ts
import { Button } from '@/components/ui/button'
```

Add:
```ts
import { teamInitials } from '@/lib/format'
```

Delete the private function (around line 83):
```ts
function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}
```

- [ ] **Step 2: Replace all `initials(...)` calls with `teamInitials(...)`**

There are 3 call sites in this file (lines ~176, ~461, ~524 in the original).

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx
git commit -m "refactor: use teamInitials from lib/format in BracketSetupView"
```

---

## Task 8: Update `team/[teamId]/page.tsx`

**Files:**
- Modify: `web/app/t/[id]/team/[teamId]/page.tsx`

- [ ] **Step 1: Add import and remove private `initials`**

Current imports of `web/app/t/[id]/team/[teamId]/page.tsx`:
```ts
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
```

Add:
```ts
import { teamInitials } from '@/lib/format'
```

Delete the private function:
```ts
function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
```

- [ ] **Step 2: Replace `initials(team.name)` with `teamInitials(team.name)`**

There are 2 call sites (the header avatar and the page-level avatar).

- [ ] **Step 3: Typecheck**

```bash
cd web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "web/app/t/[id]/team/[teamId]/page.tsx"
git commit -m "refactor: use teamInitials from lib/format in team page"
```

---

## Task 9: Update `component-map.md` and `CLAUDE.md`

**Files:**
- Modify: `docs/frontend/component-map.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add `lib/` structure section to `docs/frontend/component-map.md`**

Append a new section at the end of `docs/frontend/component-map.md`:

```markdown
---

## `lib/` utility modules

Shared logic that does not render UI. Import from here instead of writing local copies.

| Module | Exports | Who uses it |
|---|---|---|
| `lib/format.ts` | `teamInitials`, `formatClock`, `formatMatchTime`, `formatRange` | All surfaces — public components, admin components, pages |
| `lib/match-phase.ts` | `isGroupStageMatch`, `isKnockoutMatch` | Admin pages: `ko-fixtures`, `rd-fixtures`, `knockout/page`, `layout`, `MatchViews` |
| `lib/qualifiers.ts` | `computeGroupStandings` | `knockout/page.tsx` (determines which teams advance) |
| `lib/lock-rules.ts` | `canAddFixture`, `canManageTeams` | Admin fixture + team pages |
| `lib/format.ts` note | `formatClock` = time only (HH:MM, 24h). `formatMatchTime` = time + date. `formatRange` = date range. `teamInitials` = 2-letter team avatar. | — |

> **Rule:** Before writing a local formatting or phase-checking helper, search `lib/` first. If it's not there and it's used in more than one file, add it to the right module.
```

- [ ] **Step 2: Add `lib/` structure note to `CLAUDE.md`**

In `CLAUDE.md`, inside the `## Previous Knowledge` section, add a line pointing to the lib structure:

```markdown
The `lib/` directory contains shared utilities — `lib/format.ts` for formatting (teamInitials, formatClock, etc.), `lib/match-phase.ts` for phase filtering, `lib/qualifiers.ts` for standings. **Before writing any local helper function, check `lib/` first.** If the helper is used in more than one file, it belongs in `lib/`.
```

- [ ] **Step 3: Typecheck to confirm nothing broken**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add docs/frontend/component-map.md CLAUDE.md
git commit -m "docs: document lib/ utility structure and extraction rules"
```
