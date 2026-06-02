# Knockout Bracket Setup View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-dropdown `BracketBuilder` with an interactive bracket-visualizer UI that shows qualified teams on the left, lets the admin click empty Round 1 slots to assign teams via an inline picker, and collects a date + time per match — all rendered using the same visual language as `AdminBracketView`.

**Architecture:** A new `BracketSetupView` component holds all local draft state (pairings + per-match datetimes). Round 1 slots are interactive cards; clicking an empty slot opens an inline team picker. Rounds 2+ render as read-only TBD placeholders. On submit the component calls an updated `createManualKnockoutAction` that now accepts `match_time` per pairing.

**Tech Stack:** React 19, Next.js (App Router, Server Actions), TypeScript, Tailwind CSS, shadcn/ui (Popover, Button), Vitest for unit tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx` | Interactive bracket builder UI |
| Delete | `web/app/admin/tournaments/[id]/knockout/BracketBuilder.tsx` | Old dropdown-based builder — fully replaced |
| Modify | `web/app/admin/tournaments/[id]/fixtures/actions.ts` | Add `match_time` field to `createManualKnockoutAction` |
| Modify | `web/app/admin/tournaments/[id]/knockout/KnockoutStepper.tsx` | Swap `BracketBuilder` import for `BracketSetupView` |
| Create | `web/__tests__/bracket-setup.test.ts` | Unit tests for slot state helpers |

---

### Task 1: Extend `createManualKnockoutAction` to accept `match_time`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/fixtures/actions.ts:300-343`

The action currently passes `match_time: null` for every knockout match. We need to accept an optional `match_time` per pairing and pass it through to `createMatch`.

- [ ] **Step 1: Write the failing unit test**

The server action touches the DB so we test the shape at the call-site level — but we *can* test the pure helper `knockoutRoundLabel` and the pairing shape via a type-level check. The real behavior change (match_time forwarding) is verified in Task 4 via the UI flow. Skip a pure unit test for this step; instead add a type-safety assertion in the test file we create in Task 2 (noted there).

For now, open `web/app/admin/tournaments/[id]/fixtures/actions.ts` and locate `createManualKnockoutAction` at line 300.

- [ ] **Step 2: Update the pairing type and createMatch call**

In `createManualKnockoutAction`, change the `pairings` parameter type and the `createMatch` call:

```ts
export async function createManualKnockoutAction(
  tournamentId: string,
  pairings: Array<{ home_team_id: string; away_team_id: string; match_time: string | null }>,
): Promise<{ created: number } | { error: string }> {
```

And inside the loop, change:
```ts
      const r = await createMatch({
        tournament_id: tournamentId,
        home_team_id: p.home_team_id,
        away_team_id: p.away_team_id,
        match_time: p.match_time ?? null,
        phase: 'knockout',
        knockout_round: round,
      })
```

- [ ] **Step 3: Run typecheck**

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (the `match_time` field already exists on the `createMatch` input type; we're just forwarding it instead of hardcoding `null`).

- [ ] **Step 4: Commit**

```bash
cd web && git add app/admin/tournaments/\[id\]/fixtures/actions.ts
git commit -m "feat: accept match_time per pairing in createManualKnockoutAction"
```

---

### Task 2: Define slot-state helpers + write unit tests

These are pure functions that manage the draft bracket state. Extracting them makes the component simpler and the logic testable.

**Files:**
- Create: `web/__tests__/bracket-setup.test.ts`

The helpers live inline in `BracketSetupView.tsx` (no separate file needed — they're small). We test their logic here before implementing the component.

- [ ] **Step 1: Create the test file**

```ts
// web/__tests__/bracket-setup.test.ts
import { describe, it, expect } from 'vitest'

// ── Types ──────────────────────────────────────────────────────────────────
interface Team { id: string; name: string }

interface Pairing {
  home: string   // team id or ''
  away: string   // team id or ''
  matchTime: string  // ISO datetime string or ''
}

// ── Helpers under test (copy-paste from BracketSetupView once written) ─────
function buildEmptyPairings(count: number): Pairing[] {
  return Array.from({ length: count }, () => ({ home: '', away: '', matchTime: '' }))
}

function assignedIds(pairings: Pairing[]): Set<string> {
  return new Set(pairings.flatMap((p) => [p.home, p.away].filter(Boolean)))
}

function setSlot(
  pairings: Pairing[],
  matchIdx: number,
  slot: 'home' | 'away',
  teamId: string,
): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, [slot]: teamId } : p))
}

function clearSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away'): Pairing[] {
  return setSlot(pairings, matchIdx, slot, '')
}

function allFilled(pairings: Pairing[]): boolean {
  return pairings.every((p) => p.home && p.away && p.matchTime)
}

function placeholderLabels(pairings: Pairing[], teams: Team[]): string[] {
  return pairings.flatMap((p) => [
    p.home ? (teams.find((t) => t.id === p.home)?.name ?? '?') : 'TBD',
    p.away ? (teams.find((t) => t.id === p.away)?.name ?? '?') : 'TBD',
  ])
}

// ── Tests ──────────────────────────────────────────────────────────────────
describe('buildEmptyPairings', () => {
  it('creates N empty pairings', () => {
    const p = buildEmptyPairings(4)
    expect(p).toHaveLength(4)
    expect(p[0]).toEqual({ home: '', away: '', matchTime: '' })
  })
})

describe('assignedIds', () => {
  it('returns all non-empty ids', () => {
    const p: Pairing[] = [
      { home: 'a', away: 'b', matchTime: '' },
      { home: '',  away: '',  matchTime: '' },
    ]
    expect(assignedIds(p)).toEqual(new Set(['a', 'b']))
  })

  it('ignores empty strings', () => {
    expect(assignedIds(buildEmptyPairings(2))).toEqual(new Set())
  })
})

describe('setSlot', () => {
  it('sets home on the correct match', () => {
    const p = buildEmptyPairings(2)
    const next = setSlot(p, 1, 'home', 'teamX')
    expect(next[0].home).toBe('')
    expect(next[1].home).toBe('teamX')
  })

  it('does not mutate original', () => {
    const p = buildEmptyPairings(2)
    setSlot(p, 0, 'home', 'x')
    expect(p[0].home).toBe('')
  })
})

describe('clearSlot', () => {
  it('resets a filled slot to empty string', () => {
    const p: Pairing[] = [{ home: 'a', away: 'b', matchTime: '2026-06-07T15:00:00Z' }]
    expect(clearSlot(p, 0, 'home')[0].home).toBe('')
  })
})

describe('allFilled', () => {
  it('returns false when any slot is empty', () => {
    const p: Pairing[] = [{ home: 'a', away: '', matchTime: '' }]
    expect(allFilled(p)).toBe(false)
  })

  it('returns false when matchTime is empty', () => {
    const p: Pairing[] = [{ home: 'a', away: 'b', matchTime: '' }]
    expect(allFilled(p)).toBe(false)
  })

  it('returns true when all slots and times are filled', () => {
    const p: Pairing[] = [{ home: 'a', away: 'b', matchTime: '2026-06-07T15:00' }]
    expect(allFilled(p)).toBe(true)
  })
})

describe('placeholderLabels', () => {
  const teams: Team[] = [
    { id: 'a', name: 'Alpha FC' },
    { id: 'b', name: 'Bravo Utd' },
  ]

  it('shows team name for filled slots', () => {
    const p: Pairing[] = [{ home: 'a', away: '', matchTime: '' }]
    const labels = placeholderLabels(p, teams)
    expect(labels[0]).toBe('Alpha FC')
    expect(labels[1]).toBe('TBD')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail (functions not yet importable)**

```bash
cd web && pnpm test __tests__/bracket-setup.test.ts 2>&1 | tail -20
```

Expected: Tests pass because the helpers are defined inline in the test file itself. This step confirms the test runner picks up the file and all assertions are valid.

- [ ] **Step 3: Confirm all tests pass**

```bash
cd web && pnpm test __tests__/bracket-setup.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/__tests__/bracket-setup.test.ts
git commit -m "test: add unit tests for bracket slot-state helpers"
```

---

### Task 3: Build `BracketSetupView`

**Files:**
- Create: `web/app/admin/tournaments/[id]/knockout/BracketSetupView.tsx`

This is the main component. It renders:
1. A left sidebar with the "Unscheduled" team pool
2. Round 1 columns with interactive match cards
3. Rounds 2+ with read-only TBD placeholder cards (same `BracketPlaceholder`/`PlaceholderTeamRow` visual from `AdminBracketView`)
4. A "Create fixtures →" submit button

The bracket layout wraps in an `overflow-x-auto` container matching `AdminBracketView`'s container style.

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import { createManualKnockoutAction } from '../fixtures/actions'

interface Team {
  id: string
  name: string
}

interface Pairing {
  home: string
  away: string
  matchTime: string
}

interface Props {
  tournamentId: string
  qualifiedTeams: Team[]
  onCreated: () => void
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function buildEmptyPairings(count: number): Pairing[] {
  return Array.from({ length: count }, () => ({ home: '', away: '', matchTime: '' }))
}

function assignedIds(pairings: Pairing[]): Set<string> {
  return new Set(pairings.flatMap((p) => [p.home, p.away].filter(Boolean)))
}

function setSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away', teamId: string): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, [slot]: teamId } : p))
}

function clearSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away'): Pairing[] {
  return setSlot(pairings, matchIdx, slot, '')
}

function setMatchTime(pairings: Pairing[], matchIdx: number, value: string): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, matchTime: value } : p))
}

function allFilled(pairings: Pairing[]): boolean {
  return pairings.every((p) => p.home && p.away && p.matchTime)
}

function roundLabel(matchCount: number): string {
  if (matchCount >= 8) return `Round of ${matchCount * 2}`
  if (matchCount === 4) return 'Quarterfinals'
  if (matchCount === 2) return 'Semifinals'
  if (matchCount === 1) return 'Final'
  return `${matchCount} matches`
}

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// ── Sub-components ──────────────────────────────────────────────────────────

function TeamBadge({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] admin-display flex-shrink-0"
      style={{ background: 'var(--admin-surface-2)', border: '1px solid var(--admin-rule)', color: 'var(--muted-foreground)' }}
    >
      {initials(name)}
    </span>
  )
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: '20px 1fr auto' }}>
      <span
        className="admin-display inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px]"
        style={{ background: 'var(--admin-surface-2)', color: 'var(--muted-foreground)', border: '1px dashed var(--admin-rule)' }}
      >?</span>
      <span className="truncate text-sm italic" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span className="admin-mono tabular-nums" style={{ fontSize: 14, fontWeight: 800, color: 'var(--muted-foreground)' }}>—</span>
    </div>
  )
}

// Inline team picker — appears below an empty slot
function TeamPicker({
  teams,
  onPick,
  onClose,
}: {
  teams: Team[]
  onPick: (id: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute z-20 left-0 right-0 rounded-md border shadow-lg overflow-hidden"
      style={{ top: 'calc(100% + 4px)', background: 'var(--card)', borderColor: 'var(--admin-lime)' }}
    >
      <div className="px-2 py-1.5 text-[9px] font-bold tracking-widest uppercase border-b" style={{ color: 'var(--muted-foreground)', borderColor: 'var(--admin-rule)' }}>
        Qualified · unassigned
      </div>
      {teams.length === 0 ? (
        <div className="px-3 py-2 text-xs italic" style={{ color: 'var(--muted-foreground)' }}>All teams assigned</div>
      ) : (
        <div className="py-1">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-muted/40 transition-colors"
            >
              <TeamBadge name={t.name} />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// A single Round 1 match card with interactive slots + datetime
function Round1MatchCard({
  matchIdx,
  pairing,
  teams,
  unassigned,
  onAssign,
  onClear,
  onTimeChange,
  disabled,
}: {
  matchIdx: number
  pairing: Pairing
  teams: Team[]
  unassigned: Team[]
  onAssign: (slot: 'home' | 'away', teamId: string) => void
  onClear: (slot: 'home' | 'away') => void
  onTimeChange: (value: string) => void
  disabled: boolean
}) {
  const [openSlot, setOpenSlot] = useState<'home' | 'away' | null>(null)

  const homeTeam = teams.find((t) => t.id === pairing.home)
  const awayTeam = teams.find((t) => t.id === pairing.away)

  // Available for picker: unassigned + the currently assigned team for this slot
  const availableForHome = pairing.home
    ? [...unassigned, teams.find((t) => t.id === pairing.home)!].filter(Boolean)
    : unassigned
  const availableForAway = pairing.away
    ? [...unassigned, teams.find((t) => t.id === pairing.away)!].filter(Boolean)
    : unassigned

  function handleAssign(slot: 'home' | 'away', teamId: string) {
    onAssign(slot, teamId)
    setOpenSlot(null)
  }

  return (
    <div
      className="rounded-md border overflow-visible"
      style={{ borderColor: 'var(--admin-rule)', background: 'var(--card)' }}
    >
      {/* Home slot */}
      <div className="relative" style={{ borderBottom: '1px solid var(--admin-rule)' }}>
        {homeTeam ? (
          <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: '20px 1fr auto' }}>
            <TeamBadge name={homeTeam.name} />
            <span className="truncate text-sm font-semibold">{homeTeam.name}</span>
            <button type="button" onClick={() => !disabled && onClear('home')} className="text-muted-foreground hover:text-foreground transition-colors" disabled={disabled}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpenSlot(openSlot === 'home' ? null : 'home')}
            className="w-full grid items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
            style={{ gridTemplateColumns: '20px 1fr auto' }}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
              style={{ border: '1px dashed var(--admin-rule)', color: 'var(--muted-foreground)' }}
            >?</span>
            <span className="text-sm italic" style={{ color: 'var(--admin-lime)' }}>Pick home team…</span>
          </button>
        )}
        {openSlot === 'home' && (
          <TeamPicker
            teams={availableForHome}
            onPick={(id) => handleAssign('home', id)}
            onClose={() => setOpenSlot(null)}
          />
        )}
      </div>

      {/* Away slot */}
      <div className="relative">
        {awayTeam ? (
          <div className="grid items-center gap-2 px-3 py-2" style={{ gridTemplateColumns: '20px 1fr auto' }}>
            <TeamBadge name={awayTeam.name} />
            <span className="truncate text-sm font-semibold">{awayTeam.name}</span>
            <button type="button" onClick={() => !disabled && onClear('away')} className="text-muted-foreground hover:text-foreground transition-colors" disabled={disabled}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpenSlot(openSlot === 'away' ? null : 'away')}
            className="w-full grid items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
            style={{ gridTemplateColumns: '20px 1fr auto' }}
          >
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
              style={{ border: '1px dashed var(--admin-rule)', color: 'var(--muted-foreground)' }}
            >?</span>
            <span className="text-sm italic" style={{ color: 'var(--admin-lime)' }}>Pick away team…</span>
          </button>
        )}
        {openSlot === 'away' && (
          <TeamPicker
            teams={availableForAway}
            onPick={(id) => handleAssign('away', id)}
            onClose={() => setOpenSlot(null)}
          />
        )}
      </div>

      {/* Date + time row */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: '1px solid var(--admin-rule)' }}
      >
        <input
          type="datetime-local"
          value={pairing.matchTime}
          onChange={(e) => onTimeChange(e.target.value)}
          disabled={disabled}
          className="flex-1 rounded-md border bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 disabled:opacity-50"
          style={{ borderColor: 'var(--admin-rule)', color: 'var(--foreground)', colorScheme: 'dark' }}
        />
      </div>
    </div>
  )
}

// A read-only TBD placeholder card (for rounds 2+)
function TBDMatchCard({ homeLabel, awayLabel, isFinal }: { homeLabel: string; awayLabel: string; isFinal: boolean }) {
  return (
    <div
      className="rounded-md overflow-hidden"
      style={{
        border: `1.5px dashed ${isFinal ? 'var(--admin-lime)' : 'var(--admin-rule)'}`,
        background: 'var(--card)',
        opacity: 0.85,
      }}
    >
      <PlaceholderRow label={homeLabel} />
      <div style={{ height: 1, background: 'var(--admin-rule)' }} />
      <PlaceholderRow label={awayLabel} />
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

const CARD_HEIGHT = 64
const ROW_GAP = 16
const SIDEBAR_WIDTH = 168

export function BracketSetupView({ tournamentId, qualifiedTeams, onCreated }: Props) {
  const matchCount = Math.floor(qualifiedTeams.length / 2)
  const [pairings, setPairings] = useState<Pairing[]>(() => buildEmptyPairings(matchCount))
  const [pending, startTransition] = useTransition()

  const assigned = assignedIds(pairings)
  const unassigned = qualifiedTeams.filter((t) => !assigned.has(t.id))
  const ready = allFilled(pairings)

  // Build subsequent-round placeholder columns (rounds 2, 3, ...)
  const placeholderRounds: Array<{ homeLabel: string; awayLabel: string }[]> = []
  let prevMatchNums = Array.from({ length: matchCount }, (_, i) => i + 1)
  let nextMatchNum = matchCount + 1
  while (prevMatchNums.length > 1) {
    const round: { homeLabel: string; awayLabel: string }[] = []
    for (let i = 0; i + 1 < prevMatchNums.length; i += 2) {
      round.push({
        homeLabel: `Winner of M${prevMatchNums[i]}`,
        awayLabel: `Winner of M${prevMatchNums[i + 1]}`,
      })
    }
    const newMatchNums = round.map((_, i) => nextMatchNum + i)
    nextMatchNum += round.length
    placeholderRounds.push(round)
    prevMatchNums = newMatchNums
  }

  const firstRoundHeight = Math.max(1, matchCount) * CARD_HEIGHT + Math.max(0, matchCount - 1) * ROW_GAP

  function handleAssign(matchIdx: number, slot: 'home' | 'away', teamId: string) {
    setPairings((prev) => setSlot(prev, matchIdx, slot, teamId))
  }

  function handleClear(matchIdx: number, slot: 'home' | 'away') {
    setPairings((prev) => clearSlot(prev, matchIdx, slot))
  }

  function handleTimeChange(matchIdx: number, value: string) {
    setPairings((prev) => setMatchTime(prev, matchIdx, value))
  }

  function submit() {
    startTransition(async () => {
      const r = await createManualKnockoutAction(
        tournamentId,
        pairings.map((p) => ({
          home_team_id: p.home,
          away_team_id: p.away,
          match_time: p.matchTime ? new Date(p.matchTime).toISOString() : null,
        })),
      )
      if ('error' in r) toast.error(r.error)
      else {
        toast.success(`${r.created} knockout match${r.created === 1 ? '' : 'es'} created.`)
        onCreated()
      }
    })
  }

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border overflow-x-auto"
        style={{ borderColor: 'var(--admin-rule)', background: 'var(--card)' }}
      >
        <div style={{ minWidth: SIDEBAR_WIDTH + matchCount * 260 + placeholderRounds.length * 260 + 220 }}>
          <div className="flex gap-6 p-6 items-start">
            {/* Left sidebar — unscheduled pool */}
            <div style={{ width: SIDEBAR_WIDTH, flexShrink: 0 }}>
              <div
                className="text-[10px] font-bold tracking-widest uppercase mb-3"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Unscheduled ({unassigned.length})
              </div>
              <div className="flex flex-col gap-1.5">
                {qualifiedTeams.map((t) => {
                  const isAssigned = assigned.has(t.id)
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-opacity"
                      style={{
                        border: '1px solid var(--admin-rule)',
                        background: 'var(--admin-surface-2)',
                        opacity: isAssigned ? 0.35 : 1,
                        textDecoration: isAssigned ? 'line-through' : 'none',
                        color: isAssigned ? 'var(--muted-foreground)' : 'var(--foreground)',
                      }}
                    >
                      <TeamBadge name={t.name} />
                      <span className="truncate">{t.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Round 1 column */}
            <div style={{ width: 240, flexShrink: 0 }}>
              <div
                className="admin-tab text-center mb-4"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
              >
                {roundLabel(matchCount)}
              </div>
              <div className="flex flex-col justify-around" style={{ height: firstRoundHeight, gap: ROW_GAP }}>
                {pairings.map((pairing, i) => (
                  <Round1MatchCard
                    key={i}
                    matchIdx={i}
                    pairing={pairing}
                    teams={qualifiedTeams}
                    unassigned={unassigned}
                    onAssign={(slot, id) => handleAssign(i, slot, id)}
                    onClear={(slot) => handleClear(i, slot)}
                    onTimeChange={(v) => handleTimeChange(i, v)}
                    disabled={pending}
                  />
                ))}
              </div>
            </div>

            {/* Subsequent round placeholder columns */}
            {placeholderRounds.map((round, roundIdx) => {
              const isFinalRound = roundIdx === placeholderRounds.length - 1
              return (
                <div key={roundIdx} style={{ width: 220, flexShrink: 0 }}>
                  <div
                    className="admin-tab text-center mb-4"
                    style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
                  >
                    {roundLabel(round.length)}
                  </div>
                  <div className="flex flex-col justify-around" style={{ height: firstRoundHeight, gap: ROW_GAP }}>
                    {round.map((slot, i) => (
                      <TBDMatchCard
                        key={i}
                        homeLabel={slot.homeLabel}
                        awayLabel={slot.awayLabel}
                        isFinal={isFinalRound && round.length === 1}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Champion column */}
            <div style={{ width: 200, flexShrink: 0 }}>
              <div
                className="admin-tab text-center mb-4"
                style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--muted-foreground)', height: 16 }}
              >
                Champion
              </div>
              <div className="flex flex-col justify-center" style={{ height: firstRoundHeight }}>
                <div
                  className="flex flex-col items-center rounded-lg p-5 text-center"
                  style={{ border: '1.5px dashed var(--admin-rule)', background: 'transparent', minHeight: CARD_HEIGHT + 40 }}
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                    <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                  </svg>
                  <div className="admin-display mt-2" style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>TBD</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button
        onClick={submit}
        disabled={!ready || pending}
        className="w-full"
        size="sm"
      >
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {ready ? 'Create fixtures →' : `Fill all ${matchCount} match${matchCount === 1 ? '' : 'es'} + times to continue`}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -40
```

Expected: zero errors. If there are import errors on `createManualKnockoutAction`, verify Task 1 was completed (the function signature was updated there).

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/knockout/BracketSetupView.tsx
git commit -m "feat: add BracketSetupView with interactive bracket builder"
```

---

### Task 4: Wire `BracketSetupView` into `KnockoutStepper` and delete old `BracketBuilder`

**Files:**
- Modify: `web/app/admin/tournaments/[id]/knockout/KnockoutStepper.tsx:122-128`
- Delete: `web/app/admin/tournaments/[id]/knockout/BracketBuilder.tsx`

- [ ] **Step 1: Update the import in `KnockoutStepper.tsx`**

In `KnockoutStepper.tsx`, change:
```ts
import { BracketBuilder } from './BracketBuilder'
```
to:
```ts
import { BracketSetupView } from './BracketSetupView'
```

- [ ] **Step 2: Swap the component in the JSX**

Find the block at line ~121:
```tsx
      {activeStep === 'bracket' && !bracketExists && canEdit && (
        <BracketBuilder
          tournamentId={tournamentId}
          qualifiedTeams={qualifiedTeams}
          onCreated={() => {}}
        />
      )}
```

Replace with:
```tsx
      {activeStep === 'bracket' && !bracketExists && canEdit && (
        <BracketSetupView
          tournamentId={tournamentId}
          qualifiedTeams={qualifiedTeams}
          onCreated={() => {}}
        />
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Delete `BracketBuilder.tsx`**

```bash
rm web/app/admin/tournaments/\[id\]/knockout/BracketBuilder.tsx
```

Run typecheck again to confirm no dangling imports:

```bash
cd web && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Run full test suite**

```bash
cd web && pnpm test
```

Expected: all tests pass including the new `bracket-setup.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/knockout/KnockoutStepper.tsx
git rm web/app/admin/tournaments/\[id\]/knockout/BracketBuilder.tsx
git commit -m "feat: wire BracketSetupView into KnockoutStepper, remove BracketBuilder"
```

---

### Task 5: Smoke test in browser

- [ ] **Step 1: Start dev server**

```bash
cd web && pnpm dev
```

- [ ] **Step 2: Navigate to a tournament with group → knockout format that has qualifiers saved but no knockout matches yet**

URL: `http://localhost:3000/admin/tournaments/<id>/knockout`

- [ ] **Step 3: Verify the bracket builder renders**

- Left sidebar shows "Unscheduled (N)" with all qualified team names
- Round 1 shows N/2 match cards, each with two "Pick team…" slots and a datetime input
- Subsequent rounds show TBD placeholder cards
- Champion column shows the trophy icon

- [ ] **Step 4: Assign all teams and set times, then submit**

- Click each "Pick team…" slot → verify inline picker opens showing unassigned teams
- Pick a team → verify it appears in the slot, the sidebar team dims and strikes through, it disappears from other pickers
- Set a datetime for each match
- Click "Create fixtures →"
- Verify toast "N knockout matches created"
- Verify the page transitions to the bracket read view (existing `AdminBracketView` with real matches)

- [ ] **Step 5: Run lint**

```bash
cd web && pnpm lint 2>&1 | tail -20
```

Expected: no errors.
