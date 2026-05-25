# Fixtures Page Three-Section Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/setup/fixtures` into three stacked sections — a timeline (all matches grouped by day), a group stage section (round-robin match scheduling, conditional on format), and a knockout bracket section (visual bracket with click-to-edit slots, conditional on format).

**Architecture:** Add `phase` (`group`|`knockout`) and `knockout_round` columns to the matches table so each match knows which section it belongs to. Extend the existing `BracketView` component with an optional `onSlotClick` callback — when the prop is absent the component is read-only; when present, slots become clickable. The parent (fixtures page) owns role checks and DB writes; `BracketView` stays role-agnostic. The fixtures page splits into three focused section components, each filtering `matches` from `SetupContext` by phase.

**Tech Stack:** Next.js App Router (`'use client'`), Supabase (SQL migration via dashboard), TypeScript, Tailwind CSS, Vitest

---

### Task 1: DB Migration — add phase and knockout_round to matches

**Files:**
- Create: `supabase/migrations/20260520_add_match_phase_knockout_round.sql`

- [ ] **Step 1: Create the migrations directory and write the SQL**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/20260520_add_match_phase_knockout_round.sql`:

```sql
ALTER TABLE matches
  ADD COLUMN phase text NOT NULL DEFAULT 'group'
    CHECK (phase IN ('group', 'knockout'));

ALTER TABLE matches
  ADD COLUMN knockout_round text
    CHECK (knockout_round IN ('r32', 'r16', 'qf', 'sf', 'final'));
```

- [ ] **Step 2: Apply the migration via Supabase dashboard**

Open the SQL Editor in the Supabase dashboard (project: `football-manager-dev`), paste the SQL from Step 1, and run it.

- [ ] **Step 3: Verify the columns exist**

In the Supabase dashboard Table Editor, open the `matches` table and confirm:
- `phase` column: type `text`, not null, default `'group'`
- `knockout_round` column: type `text`, nullable

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260520_add_match_phase_knockout_round.sql
git commit -m "feat(db): add phase and knockout_round columns to matches"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `web/lib/supabase/types.ts`

- [ ] **Step 1: Add MatchPhase and MatchKnockoutRound types**

In `web/lib/supabase/types.ts`, add these two lines after the existing type exports at the top:

```ts
export type MatchPhase = 'group' | 'knockout'
export type MatchKnockoutRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final'
```

- [ ] **Step 2: Add the new fields to the Match interface**

In the `Match` interface, add after `match_finished_at`:

```ts
  phase: MatchPhase
  knockout_round: MatchKnockoutRound | null
```

- [ ] **Step 3: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/supabase/types.ts
git commit -m "feat(types): add MatchPhase and MatchKnockoutRound; update Match interface"
```

---

### Task 3: Update createMatch to accept phase and knockout_round

**Files:**
- Modify: `web/lib/db/matches.ts`
- Modify: `web/lib/db/__tests__/matches.test.ts`

- [ ] **Step 1: Write two failing tests**

In `web/lib/db/__tests__/matches.test.ts`, add inside the existing `describe('matches DAL')` block:

```ts
it('createMatch sends phase and knockout_round when provided', async () => {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn().mockReturnValue({ insert })
  const client = { from } as any
  await createMatch(client, 't1', 'h1', 'a1', '2026-01-01T10:00:00Z', 'knockout', 'qf')
  expect(insert).toHaveBeenCalledWith({
    tournament_id: 't1',
    home_team_id: 'h1',
    away_team_id: 'a1',
    match_time: '2026-01-01T10:00:00Z',
    phase: 'knockout',
    knockout_round: 'qf',
  })
})

it('createMatch defaults phase to group and knockout_round to null', async () => {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null })
  const from = vi.fn().mockReturnValue({ insert })
  const client = { from } as any
  await createMatch(client, 't1', 'h1', 'a1', '2026-01-01T10:00:00Z')
  expect(insert).toHaveBeenCalledWith({
    tournament_id: 't1',
    home_team_id: 'h1',
    away_team_id: 'a1',
    match_time: '2026-01-01T10:00:00Z',
    phase: 'group',
    knockout_round: null,
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd web && pnpm test -- --reporter=verbose matches
```

Expected: the two new tests FAIL because the current `createMatch` does not include `phase`/`knockout_round` in its insert payload.

- [ ] **Step 3: Update the import line in matches.ts**

Replace the existing import at the top of `web/lib/db/matches.ts`:

```ts
import type { MatchWithTeams, MatchStatus, Match, MatchPhase, MatchKnockoutRound } from '@/lib/supabase/types'
```

- [ ] **Step 4: Replace the createMatch function**

In `web/lib/db/matches.ts`, replace the `createMatch` function:

```ts
export async function createMatch(
  supabase: SupabaseClient,
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  matchTime: string,
  phase: MatchPhase = 'group',
  knockoutRound: MatchKnockoutRound | null = null,
): Promise<void> {
  const { error } = await supabase.from('matches').insert({
    tournament_id: tournamentId,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    match_time: matchTime,
    phase,
    knockout_round: knockoutRound,
  })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd web && pnpm test -- --reporter=verbose matches
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 6: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/lib/db/matches.ts web/lib/db/__tests__/matches.test.ts
git commit -m "feat(db): add optional phase and knockout_round params to createMatch"
```

---

### Task 4: Update bracket/page.tsx to tag knockout matches correctly

The existing bracket setup page creates first-round knockout matches. It should now pass `phase: 'knockout'` and the correct `knockout_round` for the first round.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/bracket/page.tsx`

- [ ] **Step 1: Add the firstRound helper and import MatchKnockoutRound**

At the top of `web/app/admin/tournaments/[id]/setup/bracket/page.tsx`, update the import from `@/lib/supabase/types` to also include `MatchKnockoutRound`:

```ts
import type { Standing, KnockoutStartRound, MatchKnockoutRound } from '@/lib/supabase/types'
```

Add this helper function after the imports, before the component:

```ts
function firstRound(start: KnockoutStartRound | null): MatchKnockoutRound {
  const map: Record<KnockoutStartRound, MatchKnockoutRound> = {
    top_32: 'r32',
    top_16: 'r16',
    top_8: 'qf',
    semi: 'sf',
    final: 'final',
  }
  return start ? map[start] : 'qf'
}
```

- [ ] **Step 2: Update createMatch call in handleConfirm**

In `handleConfirm`, replace the `createMatch` call:

```ts
await createMatch(
  supabase,
  tournament.id,
  slot.home_team_id,
  slot.away_team_id,
  new Date(`${slot.match_date}T${slot.match_time}`).toISOString(),
  'knockout',
  firstRound(tournament.knockout_start_round),
)
```

- [ ] **Step 3: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/[id]/setup/bracket/page.tsx
git commit -m "feat(bracket): tag KO matches with phase=knockout and correct knockout_round"
```

---

### Task 5: Extend BracketView with onSlotClick and knockout_round bucketing

Replace the current heuristic (array-position → round) with explicit `knockout_round` field bucketing. Add an optional `onSlotClick` prop so the parent can make slots interactive without the component knowing about roles or permissions.

**Files:**
- Modify: `web/components/BracketView.tsx`

- [ ] **Step 1: Replace the full contents of BracketView.tsx**

```tsx
import type { MatchWithTeams, KnockoutStartRound, MatchKnockoutRound } from '@/lib/supabase/types'

interface BracketViewProps {
  matches: MatchWithTeams[]
  knockoutStartRound?: KnockoutStartRound
  onSlotClick?: (round: MatchKnockoutRound, slotIndex: number) => void
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function BracketTeamRow({ name, score, winner, loser, tbd }: {
  name: string
  score: number | null
  winner: boolean
  loser: boolean
  tbd?: boolean
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr auto',
      alignItems: 'center', gap: 10, padding: '10px 14px',
      borderBottom: '1px solid var(--ink-700)',
      background: winner ? 'rgba(163,230,53,0.06)' : 'transparent',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 999,
        background: tbd ? 'var(--ink-700)' : 'var(--ink-600)',
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 9,
        color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {tbd ? '?' : initials(name)}
      </span>
      <span style={{
        fontWeight: 700, fontSize: 13,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        color: tbd ? 'var(--ink-500)' : loser ? 'var(--ink-400)' : 'var(--ink-50)',
        fontStyle: tbd ? 'italic' : 'normal',
      }}>
        {tbd ? 'TBD' : name}
      </span>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
        fontVariantNumeric: 'tabular-nums',
        color: winner ? 'var(--brand-lime)' : loser ? 'var(--ink-400)' : 'var(--ink-50)',
      }}>
        {score == null ? '—' : score}
      </span>
    </div>
  )
}

function BracketMatch({ match, clickable }: { match: MatchWithTeams | null; clickable: boolean }) {
  const isLive     = match?.status === 'live'
  const isFinished = match?.status === 'finished'
  const homeWon    = isFinished && !!match && match.home_score > match.away_score
  const awayWon    = isFinished && !!match && match.away_score > match.home_score

  return (
    <div style={{
      background: 'var(--ink-900)',
      border: `1px solid ${isLive ? 'rgba(220,38,38,0.5)' : clickable ? 'rgba(163,230,53,0.3)' : 'var(--ink-700)'}`,
      borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative',
      transition: 'border-color 120ms ease',
    }}>
      {isLive && (
        <span style={{
          position: 'absolute', top: -8, right: 8,
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 9,
          background: 'var(--red-card)', color: '#fff',
          padding: '2px 8px', borderRadius: 999, letterSpacing: '0.1em',
        }}>LIVE</span>
      )}
      {!match ? (
        <>
          <div style={{ borderBottom: '1px solid var(--ink-700)' }}>
            <BracketTeamRow name="TBD" score={null} winner={false} loser={false} tbd />
          </div>
          <BracketTeamRow name="TBD" score={null} winner={false} loser={false} tbd />
        </>
      ) : (
        <>
          <div style={{ borderBottom: '1px solid var(--ink-700)' }}>
            <BracketTeamRow name={match.home_team.name} score={match.status === 'scheduled' ? null : match.home_score} winner={homeWon} loser={awayWon} />
          </div>
          <BracketTeamRow name={match.away_team.name} score={match.status === 'scheduled' ? null : match.away_score} winner={awayWon} loser={homeWon} />
        </>
      )}
    </div>
  )
}

function BracketRound({ label, matches, slotCount, round, onSlotClick }: {
  label: string
  matches: (MatchWithTeams | null)[]
  slotCount: number
  round: MatchKnockoutRound
  onSlotClick?: (round: MatchKnockoutRound, slotIndex: number) => void
}) {
  const slots = Array.from({ length: slotCount }, (_, i) => matches[i] ?? null)
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-around', gap: 20, position: 'relative',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)',
        textAlign: 'center', marginBottom: 12,
      }}>{label}</div>
      {slots.map((m, i) => (
        <div
          key={i}
          onClick={onSlotClick ? () => onSlotClick(round, i) : undefined}
          style={{ cursor: onSlotClick ? 'pointer' : 'default' }}
        >
          <BracketMatch match={m} clickable={!!onSlotClick} />
        </div>
      ))}
    </div>
  )
}

const ROUND_LABELS: Record<MatchKnockoutRound, string> = {
  r32: 'Round of 32', r16: 'Round of 16', qf: 'Quarterfinals', sf: 'Semifinals', final: 'Final',
}
const SLOT_COUNTS: Record<MatchKnockoutRound, number> = {
  r32: 16, r16: 8, qf: 4, sf: 2, final: 1,
}
const ROUNDS_BY_START: Record<KnockoutStartRound, MatchKnockoutRound[]> = {
  top_32: ['r32', 'r16', 'qf', 'sf', 'final'],
  top_16: ['r16', 'qf', 'sf', 'final'],
  top_8:  ['qf', 'sf', 'final'],
  semi:   ['sf', 'final'],
  final:  ['final'],
}

export function BracketView({ matches, knockoutStartRound, onSlotClick }: BracketViewProps) {
  const rounds = ROUNDS_BY_START[knockoutStartRound ?? 'top_8']

  const byRound = (r: MatchKnockoutRound): MatchWithTeams[] =>
    matches.filter(m => m.knockout_round === r)

  const finalMatches = byRound('final')
  const finalist = finalMatches[0]
  const champion =
    finalist?.status === 'finished'
      ? finalist.home_score > finalist.away_score
        ? finalist.home_team.name
        : finalist.away_team.name
      : null

  if (matches.length === 0 && !onSlotClick) {
    return (
      <p style={{ color: 'var(--ink-400)', textAlign: 'center', padding: '48px 0' }}>
        No knockout matches yet.
      </p>
    )
  }

  return (
    <div style={{
      background: `radial-gradient(ellipse 80% 80% at 50% 50%, rgba(163,230,53,0.06), transparent 70%), var(--ink-800)`,
      border: '1px solid var(--ink-700)',
      borderRadius: 'var(--radius-xl)',
      padding: '32px clamp(16px, 3vw, 32px)',
      overflowX: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 'clamp(24px, 4vw, 64px)', minWidth: 480 }}>
        {rounds.map(r => (
          <BracketRound
            key={r}
            label={ROUND_LABELS[r]}
            matches={byRound(r)}
            slotCount={SLOT_COUNTS[r]}
            round={r}
            onSlotClick={onSlotClick}
          />
        ))}

        {/* Champion cell */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: 20,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-400)',
            textAlign: 'center', marginBottom: 12,
          }}>Champion</div>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 24,
            background: `radial-gradient(circle at center, rgba(163,230,53,0.18), transparent 60%), var(--ink-900)`,
            border: '1.5px solid var(--brand-lime)', borderRadius: 'var(--radius-md)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand-lime)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
              <path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14,
              letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-lime)', marginTop: 8,
            }}>Champion</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
              color: 'var(--ink-50)', marginTop: 6, textTransform: 'uppercase',
            }}>
              {champion ?? 'TBD'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/BracketView.tsx
git commit -m "feat(BracketView): add onSlotClick prop and knockout_round-based bucketing"
```

---

### Task 6: Redesign setup/fixtures/page.tsx into three sections

Replace the current flat fixtures list with three stacked sections: Timeline, Group Stage, and Knockout Bracket.

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/fixtures/page.tsx`

- [ ] **Step 1: Replace the full file contents**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/components/Toast'
import { canAddFixture, canDeleteFixture, canEditMatchTime } from '@/lib/lock-rules'
import { createClient } from '@/lib/supabase/client'
import { createMatch, deleteMatch, updateMatchTime } from '@/lib/db/matches'
import { BracketView } from '@/components/BracketView'
import { useSetup } from '../SetupContext'
import type { MatchWithTeams, MatchKnockoutRound } from '@/lib/supabase/types'

// ─── TimePicker ──────────────────────────────────────────────────────────────

function TimePicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [h24, min] = value ? value.split(':').map(Number) : [12, 0]
  const period = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12

  function emit(newH12: number, newMin: number, newPeriod: string) {
    let h = newH12 % 12
    if (newPeriod === 'PM') h += 12
    onChange(`${String(h).padStart(2, '0')}:${String(newMin).padStart(2, '0')}`)
  }

  const seg = `${className ?? ''} text-center appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset rounded-md`.trim()

  return (
    <div className="flex items-center gap-1 border border-slate-300 rounded-lg px-2 py-1 bg-white hover:border-slate-400 transition-colors">
      <select value={h12} onChange={e => emit(Number(e.target.value), min, period)} className={seg}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-slate-400 font-bold select-none">:</span>
      <select value={min} onChange={e => emit(h12, Number(e.target.value), period)} className={seg}>
        {Array.from({ length: 60 }, (_, i) => i).map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <select value={period} onChange={e => emit(h12, min, e.target.value)} className={seg}>
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusPill(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    scheduled: { label: 'Scheduled', classes: 'bg-slate-100 text-slate-600' },
    live:      { label: 'Live',      classes: 'bg-green-100 text-green-700' },
    halftime:  { label: 'Halftime',  classes: 'bg-amber-100 text-amber-700' },
    finished:  { label: 'Finished',  classes: 'bg-blue-50 text-blue-600' },
  }
  const s = map[status] ?? { label: status, classes: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${s.classes}`}>
      {s.label}
    </span>
  )
}

function groupByDay(matches: MatchWithTeams[]) {
  const map = new Map<string, MatchWithTeams[]>()
  for (const m of matches) {
    const key = new Date(m.match_time).toLocaleDateString('en-CA') // YYYY-MM-DD, sortable
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(m)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, dayMatches]) => ({
      dayLabel: new Date(dayMatches[0].match_time).toLocaleDateString('en-MY', {
        weekday: 'short', month: 'short', day: 'numeric',
      }),
      matches: dayMatches,
    }))
}

const sel      = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const selError = 'w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50'

// ─── Section 1: Timeline ─────────────────────────────────────────────────────

function TimelineSection({ matches }: { matches: MatchWithTeams[] }) {
  const days = groupByDay(matches)
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-base font-bold mb-4">Schedule</h2>
      {days.length === 0 ? (
        <p className="text-slate-400 text-sm">No matches scheduled yet.</p>
      ) : (
        <div className="space-y-5">
          {days.map(({ dayLabel, matches: dayMatches }, i) => (
            <div key={dayLabel}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Day {i + 1} — {dayLabel}
              </p>
              <div className="space-y-1.5">
                {dayMatches.map(m => (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 rounded-lg text-sm">
                    <span className="font-medium">{m.home_team.name} vs {m.away_team.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 text-xs">
                        {new Date(m.match_time).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </span>
                      {statusPill(m.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section 2: Group Stage ───────────────────────────────────────────────────

interface GroupStageSectionProps {
  tournamentId: string
  tournamentStatus: string
  teams: { id: string; name: string }[]
  matches: MatchWithTeams[]
  refresh: () => Promise<void>
}

function GroupStageSection({ tournamentId, tournamentStatus, teams, matches, refresh }: GroupStageSectionProps) {
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', match_date: '', match_time: '12:00' })
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState('')
  const [editingTime, setEditingTime] = useState('')
  const supabase = createClient()

  const fixturesLocked = !canAddFixture(tournamentStatus as any)

  function validateForm(): string[] {
    const errors: string[] = []
    if (form.home_team_id === form.away_team_id) errors.push('A team cannot play against itself.')
    if (form.home_team_id && form.away_team_id && form.match_date && form.match_time) {
      const newTime = new Date(`${form.match_date}T${form.match_time}`).getTime()
      const clash = matches.some(m => {
        if (m.status !== 'scheduled') return false
        const existing = new Date(m.match_time).getTime()
        const diff = Math.abs(newTime - existing)
        return diff < 3600000 && (
          m.home_team_id === form.home_team_id || m.away_team_id === form.home_team_id ||
          m.home_team_id === form.away_team_id || m.away_team_id === form.away_team_id
        )
      })
      if (clash) errors.push('One of the selected teams already has a match scheduled within an hour of this time.')
    }
    return errors
  }

  function addFixture(e: React.FormEvent) {
    e.preventDefault()
    const errors = validateForm()
    setFormErrors(errors)
    if (errors.length > 0) return
    startTransition(async () => {
      try {
        await createMatch(
          supabase, tournamentId,
          form.home_team_id, form.away_team_id,
          new Date(`${form.match_date}T${form.match_time}`).toISOString(),
          'group',
        )
        setForm({ home_team_id: '', away_team_id: '', match_date: '', match_time: '12:00' })
        setFormErrors([])
        toast.success('Fixture scheduled!')
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not schedule fixture.')
      }
    })
  }

  function deleteFixture(matchId: string) {
    startTransition(async () => {
      try {
        await deleteMatch(supabase, matchId)
        toast.success('Fixture removed.')
        await refresh()
      } catch {
        toast.error('Could not remove fixture.')
      }
    })
  }

  function startEditTime(match: MatchWithTeams) {
    if (!canEditMatchTime(tournamentStatus as any, match.status)) return
    setEditingMatchId(match.id)
    const iso = new Date(match.match_time).toISOString().slice(0, 16)
    setEditingDate(iso.slice(0, 10))
    setEditingTime(iso.slice(11, 16))
  }

  async function saveEditTime() {
    if (!editingMatchId) return
    startTransition(async () => {
      try {
        await updateMatchTime(supabase, editingMatchId, new Date(`${editingDate}T${editingTime}`).toISOString())
        setEditingMatchId(null)
        setEditingDate('')
        setEditingTime('')
        toast.success('Match time updated.')
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not update match time.')
      }
    })
  }

  const days = groupByDay(matches)

  return (
    <div className="space-y-4">
      {/* Schedule form */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-bold mb-4">Group Stage</h2>
        {fixturesLocked && (
          <p className="text-xs text-amber-600 mb-3">Fixture changes are locked in this tournament state.</p>
        )}
        {teams.length < 2 ? (
          <p className="text-slate-500 text-sm">Add at least 2 teams first.</p>
        ) : (
          <form onSubmit={addFixture} className={`space-y-3 ${fixturesLocked ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Home Team</label>
                <select value={form.home_team_id} onChange={e => { setForm(f => ({ ...f, home_team_id: e.target.value })); setFormErrors([]) }} required className={formErrors.length > 0 ? selError : sel}>
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Away Team</label>
                <select value={form.away_team_id} onChange={e => { setForm(f => ({ ...f, away_team_id: e.target.value })); setFormErrors([]) }} required className={formErrors.length > 0 ? selError : sel}>
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Match Date & Time</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.match_date} onChange={e => { setForm(f => ({ ...f, match_date: e.target.value })); setFormErrors([]) }} required className={formErrors.length > 0 ? selError : sel} />
                <TimePicker value={form.match_time} onChange={v => { setForm(f => ({ ...f, match_time: v })); setFormErrors([]) }} />
              </div>
            </div>
            <button type="submit" disabled={isPending || fixturesLocked} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg text-sm">
              {isPending ? 'Scheduling…' : 'Schedule Match'}
            </button>
            {formErrors.length > 0 && (
              <ul className="space-y-1">
                {formErrors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600 flex items-center gap-1">
                    <span className="inline-block w-1 h-1 rounded-full bg-red-600 shrink-0" />
                    {err}
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}
      </div>

      {/* Group stage match list, grouped by day */}
      {days.length > 0 && (
        <div className="space-y-3">
          {days.map(({ dayLabel, matches: dayMatches }, i) => (
            <div key={dayLabel} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Day {i + 1} — {dayLabel}
              </p>
              <div className="space-y-2">
                {dayMatches.map(m => {
                  const canDelete = canDeleteFixture(tournamentStatus as any)
                  const canEdit = canEditMatchTime(tournamentStatus as any, m.status)
                  const isEditing = editingMatchId === m.id
                  return (
                    <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                        <p className="font-medium text-sm whitespace-nowrap">{m.home_team.name} vs {m.away_team.name}</p>
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input type="date" value={editingDate} onChange={e => setEditingDate(e.target.value)}
                              className="border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" autoFocus />
                            <TimePicker value={editingTime} onChange={setEditingTime} className="text-xs" />
                            <div className="flex items-center gap-2">
                              <button onClick={saveEditTime} disabled={isPending} className="text-xs font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-30 px-2.5 py-1 rounded-md">Save</button>
                              <button onClick={() => { setEditingMatchId(null); setEditingDate(''); setEditingTime('') }} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => startEditTime(m)} disabled={!canEdit}
                            className={`text-xs text-left ${canEdit ? 'text-slate-400 hover:text-green-600 cursor-pointer' : 'text-slate-300'} disabled:cursor-default`}>
                            {new Date(m.match_time).toLocaleString('en-MY', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                            {canEdit && <span className="ml-1 text-[10px] opacity-60">(edit)</span>}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {statusPill(m.status)}
                        {m.status === 'scheduled' && (
                          <button onClick={() => deleteFixture(m.id)} disabled={isPending || !canDelete} className="text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none">×</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section 3: Knockout Bracket ─────────────────────────────────────────────

interface KnockoutBracketSectionProps {
  tournamentId: string
  tournamentStatus: string
  knockoutStartRound: import('@/lib/supabase/types').KnockoutStartRound | null
  teams: { id: string; name: string }[]
  matches: MatchWithTeams[]
  canEdit: boolean
  refresh: () => Promise<void>
}

function KnockoutBracketSection({
  tournamentId, tournamentStatus, knockoutStartRound, teams, matches, canEdit, refresh,
}: KnockoutBracketSectionProps) {
  const [editingSlot, setEditingSlot] = useState<{ round: MatchKnockoutRound; slotIndex: number } | null>(null)
  const [slotForm, setSlotForm] = useState({ home_team_id: '', away_team_id: '', match_date: '', match_time: '12:00' })
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  const fixturesLocked = !canAddFixture(tournamentStatus as any)
  const editable = canEdit && !fixturesLocked

  function handleSlotClick(round: MatchKnockoutRound, slotIndex: number) {
    setEditingSlot({ round, slotIndex })
    setSlotForm({ home_team_id: '', away_team_id: '', match_date: '', match_time: '12:00' })
  }

  function saveSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!editingSlot) return
    startTransition(async () => {
      try {
        await createMatch(
          supabase, tournamentId,
          slotForm.home_team_id, slotForm.away_team_id,
          new Date(`${slotForm.match_date}T${slotForm.match_time}`).toISOString(),
          'knockout',
          editingSlot.round,
        )
        setEditingSlot(null)
        toast.success('Knockout match scheduled!')
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not schedule knockout match.')
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="text-base font-bold mb-4">Knockout Bracket</h2>
      {fixturesLocked && (
        <p className="text-xs text-amber-600 mb-3">Bracket editing is locked in this tournament state.</p>
      )}
      <BracketView
        matches={matches}
        knockoutStartRound={knockoutStartRound ?? undefined}
        onSlotClick={editable ? handleSlotClick : undefined}
      />
      {editable && (
        <p className="text-xs text-slate-400 mt-3 text-center">Click any bracket slot to schedule a match.</p>
      )}

      {/* Slot editing modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-slate-200 p-6 w-full max-w-sm mx-4 shadow-lg">
            <h3 className="text-sm font-bold mb-4">Schedule Knockout Match</h3>
            <form onSubmit={saveSlot} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Home Team</label>
                <select value={slotForm.home_team_id} onChange={e => setSlotForm(f => ({ ...f, home_team_id: e.target.value }))} required className={sel}>
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Away Team</label>
                <select value={slotForm.away_team_id} onChange={e => setSlotForm(f => ({ ...f, away_team_id: e.target.value }))} required className={sel}>
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                <input type="date" value={slotForm.match_date} onChange={e => setSlotForm(f => ({ ...f, match_date: e.target.value }))} required className={sel} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                <TimePicker value={slotForm.match_time} onChange={v => setSlotForm(f => ({ ...f, match_time: v }))} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={isPending} className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm">
                  {isPending ? 'Saving…' : 'Schedule'}
                </button>
                <button type="button" onClick={() => setEditingSlot(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SetupFixturesPage() {
  const { tournament, teams, matches, isAdmin, isOrganizer, refresh } = useSetup()
  const canEdit = isAdmin || isOrganizer

  const hasGroupStage = tournament.format === 'round_robin' || tournament.format === 'round_robin_knockout'
  const hasKnockout   = tournament.format === 'knockout'    || tournament.format === 'round_robin_knockout'

  const groupMatches   = matches.filter(m => m.phase === 'group')
  const knockoutMatches = matches.filter(m => m.phase === 'knockout')

  return (
    <div className="space-y-6">
      <TimelineSection matches={matches} />

      {hasGroupStage && (
        <GroupStageSection
          tournamentId={tournament.id}
          tournamentStatus={tournament.status}
          teams={teams}
          matches={groupMatches}
          refresh={refresh}
        />
      )}

      {hasKnockout && (
        <KnockoutBracketSection
          tournamentId={tournament.id}
          tournamentStatus={tournament.status}
          knockoutStartRound={tournament.knockout_start_round}
          teams={teams}
          matches={knockoutMatches}
          canEdit={canEdit}
          refresh={refresh}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run the full test suite**

```bash
cd web && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Smoke-test in the browser**

Start the dev server (`pnpm dev` in `/web`). Open a tournament in setup mode at `http://localhost:3000/admin/tournaments/<id>/setup/fixtures` and verify:
- For a `round_robin` tournament: Timeline + Group Stage sections visible, no bracket section
- For a `knockout` tournament: Timeline + Knockout Bracket sections visible, no group stage form
- For a `round_robin_knockout` tournament: all three sections visible
- In group stage, scheduling a match adds it to the timeline immediately after refresh
- In knockout bracket, clicking a slot opens the modal; saving creates a knockout match visible in the bracket and timeline
- On the public tournament page, `BracketView` still renders correctly without `onSlotClick`

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/[id]/setup/fixtures/page.tsx
git commit -m "feat(fixtures): redesign into timeline, group stage, and knockout bracket sections"
```
