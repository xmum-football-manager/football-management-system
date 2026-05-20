# Tournament Lifecycle Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the tournament status machine with `bracket_setup` and `knockout` states, enforce fixture-completeness checks before go-live, and provide a bracket seeding UI for `round_robin_knockout` tournaments transitioning from group stage to knockout phase.

**Architecture:** Two new status values (`bracket_setup`, `knockout`) are added to the DB check constraint and TypeScript union. The `round_robin_knockout` format lifecycle becomes `setup → active → bracket_setup → knockout → finished`. A new bracket seeding page at `/admin/tournaments/[id]/setup/bracket/` uses the existing SetupContext pattern to show standings, let the organizer assign teams to first-round slots, and start the knockout phase. Go-live checks in `GoLivePanel` gain a fixture-count check derived from `num_groups`/`teams_per_group` (group stage) or `knockout_start_round` (pure knockout).

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL text check constraint), TypeScript, Tailwind CSS, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `web/supabase/migrations/20260520000001_add_bracket_setup_knockout_status.sql` | Create | DB constraint update |
| `web/lib/supabase/types.ts` | Modify | Add new values to `TournamentStatus` |
| `web/lib/lock-rules.ts` | Modify | Lock fixtures during `bracket_setup`; add new statuses to team-management lock |
| `web/lib/__tests__/lock-rules.test.ts` | Create | Tests for updated lock rules |
| `web/lib/fixture-utils.ts` | Create | Pure helpers: `expectedGroupFixtures`, `expectedFirstRoundKOMatches` |
| `web/lib/__tests__/fixture-utils.test.ts` | Create | Tests for fixture count helpers |
| `web/lib/db/tournaments.ts` | Modify | Add `endGroupStage`, `startKnockoutPhase`; update `getLiveTournaments` |
| `web/lib/db/__tests__/tournaments.test.ts` | Modify | Tests for new functions |
| `web/app/admin/tournaments/[id]/GoLivePanel.tsx` | Modify | Add `matches` prop; add fixture-count check |
| `web/app/admin/tournaments/[id]/OverviewTab.tsx` | Modify | Add `EndGroupStagePanel`; fix `FinishPanel` for `knockout`; add status labels |
| `web/app/admin/tournaments/[id]/TabStrip.tsx` | Modify | Add conditional Bracket tab |
| `web/app/admin/tournaments/[id]/page.tsx` | Modify | Pass `showBracketTab` to TabStrip |
| `web/app/admin/tournaments/[id]/setup/layout.tsx` | Modify | Pass `showBracketTab` to TabStrip |
| `web/app/admin/tournaments/[id]/setup/bracket/page.tsx` | Create | Bracket seeding UI |

---

### Task 1: DB migration for new tournament statuses

**Files:**
- Create: `web/supabase/migrations/20260520000001_add_bracket_setup_knockout_status.sql`

- [ ] **Step 1: Write the migration**

Create `web/supabase/migrations/20260520000001_add_bracket_setup_knockout_status.sql`:

```sql
-- Drop the existing inline check constraint (auto-named by Postgres from schema.sql)
alter table tournaments drop constraint if exists tournaments_status_check;

-- Recreate with bracket_setup and knockout added
alter table tournaments add constraint tournaments_status_check
  check (status in ('setup', 'active', 'bracket_setup', 'knockout', 'finished', 'archived'));
```

- [ ] **Step 2: Apply the migration**

```bash
cd web && npx supabase db push
```

Expected: migration applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/20260520000001_add_bracket_setup_knockout_status.sql
git commit -m "feat(db): add bracket_setup and knockout tournament statuses"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `web/lib/supabase/types.ts:3`

- [ ] **Step 1: Update TournamentStatus union**

In `web/lib/supabase/types.ts`, replace line 3:

```ts
export type TournamentStatus = 'setup' | 'active' | 'finished' | 'archived'
```

With:

```ts
export type TournamentStatus = 'setup' | 'active' | 'bracket_setup' | 'knockout' | 'finished' | 'archived'
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd web && tsc --noEmit
```

Expected: errors in files that exhaustively switch/map over `TournamentStatus` — these will be fixed in later tasks. No errors in types.ts itself.

- [ ] **Step 3: Commit**

```bash
git add web/lib/supabase/types.ts
git commit -m "feat(types): add bracket_setup and knockout to TournamentStatus"
```

---

### Task 3: Update lock-rules for new statuses

**Files:**
- Create: `web/lib/__tests__/lock-rules.test.ts`
- Modify: `web/lib/lock-rules.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/__tests__/lock-rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { canAddFixture, canDeleteFixture, canManageTeams, canEditDates } from '../lock-rules'
import type { TournamentStatus } from '@/lib/supabase/types'

describe('canAddFixture', () => {
  it('returns true for setup, active, and knockout', () => {
    expect(canAddFixture('setup')).toBe(true)
    expect(canAddFixture('active')).toBe(true)
    expect(canAddFixture('knockout')).toBe(true)
  })
  it('returns false for bracket_setup (bracket manages its own fixtures)', () => {
    expect(canAddFixture('bracket_setup')).toBe(false)
  })
  it('returns false for finished and archived', () => {
    expect(canAddFixture('finished')).toBe(false)
    expect(canAddFixture('archived')).toBe(false)
  })
})

describe('canDeleteFixture', () => {
  it('returns true for setup, active, and knockout', () => {
    expect(canDeleteFixture('setup')).toBe(true)
    expect(canDeleteFixture('active')).toBe(true)
    expect(canDeleteFixture('knockout')).toBe(true)
  })
  it('returns false for bracket_setup, finished, archived', () => {
    expect(canDeleteFixture('bracket_setup')).toBe(false)
    expect(canDeleteFixture('finished')).toBe(false)
    expect(canDeleteFixture('archived')).toBe(false)
  })
})

describe('canManageTeams', () => {
  it('returns true only for setup', () => {
    expect(canManageTeams('setup')).toBe(true)
  })
  it('returns false for all live and post-live statuses', () => {
    const locked: TournamentStatus[] = ['active', 'bracket_setup', 'knockout', 'finished', 'archived']
    locked.forEach(s => expect(canManageTeams(s)).toBe(false))
  })
})

describe('canEditDates', () => {
  it('returns true only for setup', () => {
    expect(canEditDates('setup')).toBe(true)
  })
  it('returns false once tournament is live or beyond', () => {
    const locked: TournamentStatus[] = ['active', 'bracket_setup', 'knockout', 'finished', 'archived']
    locked.forEach(s => expect(canEditDates(s)).toBe(false))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && pnpm test -- --testPathPattern="lock-rules"
```

Expected: FAIL — `canAddFixture('bracket_setup')` returns `true` (not `false` yet); `canManageTeams` doesn't know about new statuses.

- [ ] **Step 3: Update lock-rules.ts**

Replace `web/lib/lock-rules.ts` entirely:

```ts
import type { MatchStatus, TournamentStatus } from '@/lib/supabase/types'

const LOCKED_TOURNAMENT_STATUSES: TournamentStatus[] = [
  'active', 'bracket_setup', 'knockout', 'finished', 'archived',
]
const FULLY_LOCKED: TournamentStatus[] = ['finished', 'archived']
const FIXTURE_LOCKED: TournamentStatus[] = ['bracket_setup', 'finished', 'archived']

export function canEditDates(tournamentStatus: TournamentStatus): boolean {
  return !LOCKED_TOURNAMENT_STATUSES.includes(tournamentStatus)
}

export function canManageTeams(tournamentStatus: TournamentStatus): boolean {
  return !LOCKED_TOURNAMENT_STATUSES.includes(tournamentStatus)
}

export function canAddFixture(tournamentStatus: TournamentStatus): boolean {
  return !FIXTURE_LOCKED.includes(tournamentStatus)
}

export function canDeleteFixture(tournamentStatus: TournamentStatus): boolean {
  return !FIXTURE_LOCKED.includes(tournamentStatus)
}

export function canEditMatchTime(
  tournamentStatus: TournamentStatus,
  matchStatus: MatchStatus,
): boolean {
  if (FULLY_LOCKED.includes(tournamentStatus)) return false
  return matchStatus === 'scheduled'
}

export function canEditTournamentMeta(tournamentStatus: TournamentStatus): boolean {
  return !FULLY_LOCKED.includes(tournamentStatus)
}

export function canEditTournamentName(
  tournamentStatus: TournamentStatus,
  startDate: string,
): boolean {
  if (FULLY_LOCKED.includes(tournamentStatus)) return false
  const deadline = new Date(startDate)
  deadline.setDate(deadline.getDate() - 14)
  return new Date() <= deadline
}

export function canEditVenueDescription(tournamentStatus: TournamentStatus): boolean {
  return tournamentStatus === 'setup'
}

export function canEditFormat(
  tournamentStatus: TournamentStatus,
  firstMatchScheduledAt: string | null,
): boolean {
  return tournamentStatus === 'setup' && firstMatchScheduledAt === null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && pnpm test -- --testPathPattern="lock-rules"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/__tests__/lock-rules.test.ts web/lib/lock-rules.ts
git commit -m "feat(lock-rules): lock fixture management during bracket_setup; add new statuses to team lock"
```

---

### Task 4: Fixture count utility functions

**Files:**
- Create: `web/lib/fixture-utils.ts`
- Create: `web/lib/__tests__/fixture-utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `web/lib/__tests__/fixture-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { expectedGroupFixtures, expectedFirstRoundKOMatches } from '../fixture-utils'
import type { Tournament } from '@/lib/supabase/types'

function makeTournament(overrides: Partial<Tournament>): Tournament {
  return {
    id: 't1', name: 'T', description: null, location: null,
    start_date: '2026-06-01', end_date: '2026-06-10',
    format: 'round_robin', points_win: 3, points_draw: 1, points_loss: 0,
    status: 'setup', first_match_scheduled_at: null,
    halftime_enabled: true, minutes_per_half: 45, halftime_minutes: 15,
    extra_time_minutes: null, penalty_shootout_enabled: false,
    require_goal_player: false, num_groups: null, teams_per_group: null,
    advance_per_group: null, knockout_start_round: null, seeding_method: null,
    min_players_per_team: 5, created_at: '', updated_at: '',
    ...overrides,
  }
}

describe('expectedGroupFixtures', () => {
  it('returns 0 when num_groups or teams_per_group is null', () => {
    expect(expectedGroupFixtures(makeTournament({}))).toBe(0)
    expect(expectedGroupFixtures(makeTournament({ num_groups: 2 }))).toBe(0)
    expect(expectedGroupFixtures(makeTournament({ teams_per_group: 4 }))).toBe(0)
  })
  it('returns 6 for 1 group of 4 teams (single round-robin)', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 1, teams_per_group: 4 }))).toBe(6)
  })
  it('returns 12 for 2 groups of 4 teams', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 2, teams_per_group: 4 }))).toBe(12)
  })
  it('returns 3 for 1 group of 3 teams', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 1, teams_per_group: 3 }))).toBe(3)
  })
  it('returns 0 for 1 group of 1 team', () => {
    expect(expectedGroupFixtures(makeTournament({ num_groups: 1, teams_per_group: 1 }))).toBe(0)
  })
})

describe('expectedFirstRoundKOMatches', () => {
  it('returns 0 for null', () => {
    expect(expectedFirstRoundKOMatches(null)).toBe(0)
  })
  it('returns correct match counts per round', () => {
    expect(expectedFirstRoundKOMatches('top_32')).toBe(16)
    expect(expectedFirstRoundKOMatches('top_16')).toBe(8)
    expect(expectedFirstRoundKOMatches('top_8')).toBe(4)
    expect(expectedFirstRoundKOMatches('semi')).toBe(2)
    expect(expectedFirstRoundKOMatches('final')).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd web && pnpm test -- --testPathPattern="fixture-utils"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create fixture-utils.ts**

Create `web/lib/fixture-utils.ts`:

```ts
import type { Tournament, KnockoutStartRound } from '@/lib/supabase/types'

export function expectedGroupFixtures(t: Tournament): number {
  const n = t.num_groups ?? 0
  const m = t.teams_per_group ?? 0
  return n * ((m * (m - 1)) / 2)
}

const FIRST_ROUND_MATCH_COUNT: Record<KnockoutStartRound, number> = {
  top_32: 16,
  top_16: 8,
  top_8: 4,
  semi: 2,
  final: 1,
}

export function expectedFirstRoundKOMatches(round: KnockoutStartRound | null): number {
  if (!round) return 0
  return FIRST_ROUND_MATCH_COUNT[round]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && pnpm test -- --testPathPattern="fixture-utils"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/fixture-utils.ts web/lib/__tests__/fixture-utils.test.ts
git commit -m "feat(utils): add fixture count helpers for go-live validation"
```

---

### Task 5: Update tournament DB functions

**Files:**
- Modify: `web/lib/db/tournaments.ts`
- Modify: `web/lib/db/__tests__/tournaments.test.ts`

- [ ] **Step 1: Add failing tests**

In `web/lib/db/__tests__/tournaments.test.ts`, add `endGroupStage` and `startKnockoutPhase` to the import line:

```ts
import {
  getTournament,
  updateTournament,
  getLiveTournaments,
  getAllTournaments,
  getTournamentsByIds,
  getAllUserRoles,
  pingTournaments,
  endGroupStage,
  startKnockoutPhase,
} from '../tournaments'
```

Append these describe blocks at the end of the file (before the final newline):

```ts
describe('endGroupStage', () => {
  it('calls update with bracket_setup status', async () => {
    const client = mockClient({ data: null, error: null })
    await endGroupStage(client, 't1')
    expect(client.from).toHaveBeenCalledWith('tournaments')
  })
  it('throws on error', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(endGroupStage(client, 't1')).rejects.toThrow('boom')
  })
})

describe('startKnockoutPhase', () => {
  it('calls update with knockout status', async () => {
    const client = mockClient({ data: null, error: null })
    await startKnockoutPhase(client, 't1')
    expect(client.from).toHaveBeenCalledWith('tournaments')
  })
  it('throws on error', async () => {
    const client = mockClient({ data: null, error: { message: 'boom' } })
    await expect(startKnockoutPhase(client, 't1')).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && pnpm test -- --testPathPattern="tournaments.test"
```

Expected: FAIL — `endGroupStage` and `startKnockoutPhase` not exported yet.

- [ ] **Step 3: Update getLiveTournaments and add new functions**

In `web/lib/db/tournaments.ts`, update `getLiveTournaments` (currently uses `.eq('status', 'active')`):

```ts
export async function getLiveTournaments(supabase: SupabaseClient): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'bracket_setup', 'knockout'])
    .order('start_date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data as Tournament[]) ?? []
}
```

Add after `finishTournament`:

```ts
export async function endGroupStage(supabase: SupabaseClient, tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'bracket_setup' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}

export async function startKnockoutPhase(supabase: SupabaseClient, tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'knockout' })
    .eq('id', tournamentId)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && pnpm test -- --testPathPattern="tournaments.test"
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/db/tournaments.ts web/lib/db/__tests__/tournaments.test.ts
git commit -m "feat(db): add endGroupStage and startKnockoutPhase; update getLiveTournaments to include new statuses"
```

---

### Task 6: Add fixture completeness check to GoLivePanel

**Files:**
- Modify: `web/app/admin/tournaments/[id]/GoLivePanel.tsx`

- [ ] **Step 1: Replace GoLivePanel.tsx**

Replace the entire content of `web/app/admin/tournaments/[id]/GoLivePanel.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { goLive } from '@/lib/db/tournaments'
import { expectedGroupFixtures, expectedFirstRoundKOMatches } from '@/lib/fixture-utils'
import type { Tournament, TeamWithPlayers, MatchWithTeams } from '@/lib/supabase/types'

interface GoLiveCheck {
  label: string
  ok: boolean
  detail?: string
}

function computeChecks(t: Tournament, teams: TeamWithPlayers[], matches: MatchWithTeams[]): GoLiveCheck[] {
  const checks: GoLiveCheck[] = []

  const hasRR = t.format === 'round_robin' || t.format === 'round_robin_knockout'
  const hasKO = t.format === 'knockout' || t.format === 'round_robin_knockout'

  // 1. Settings configured
  const settingsOk = !!(
    t.name && t.start_date && t.end_date &&
    (!hasRR || (t.num_groups && t.teams_per_group)) &&
    (!hasKO || (t.knockout_start_round && t.seeding_method))
  )
  checks.push({ label: 'All settings configured', ok: settingsOk })

  // 2. Enough teams
  const expectedTeams = hasRR ? (t.num_groups ?? 0) * (t.teams_per_group ?? 0) : 0
  const teamsOk = expectedTeams > 0 && teams.length >= expectedTeams
  checks.push({
    label: `Teams (${teams.length}/${expectedTeams})`,
    ok: teamsOk,
    detail: teamsOk ? undefined : `Add ${Math.max(0, expectedTeams - teams.length)} more team${expectedTeams - teams.length !== 1 ? 's' : ''}`,
  })

  // 3. All teams rostered
  const minPlayers = t.min_players_per_team
  const underRostered = teams.filter(tm => tm.players.length < minPlayers)
  const rosterOk = underRostered.length === 0 && teams.length > 0
  checks.push({
    label: `All teams have ≥${minPlayers} players`,
    ok: rosterOk,
    detail: rosterOk ? undefined : underRostered.map(tm => `${tm.name} (${tm.players.length}/${minPlayers})`).join(', '),
  })

  // 4. Date reached
  const today = new Date().toISOString().slice(0, 10)
  const dateOk = today >= t.start_date
  checks.push({
    label: 'Tournament date reached',
    ok: dateOk,
    detail: dateOk ? undefined : `Wait until ${formatDate(t.start_date)}`,
  })

  // 5. Fixtures scheduled
  const matchCount = matches.length
  if (hasRR) {
    const expected = expectedGroupFixtures(t)
    const fixturesOk = expected > 0 && matchCount >= expected
    const diff = Math.max(0, expected - matchCount)
    checks.push({
      label: `All group fixtures scheduled (${matchCount}/${expected})`,
      ok: fixturesOk,
      detail: fixturesOk ? undefined : `Schedule ${diff} more fixture${diff !== 1 ? 's' : ''}`,
    })
  } else {
    const expected = expectedFirstRoundKOMatches(t.knockout_start_round)
    const fixturesOk = expected > 0 && matchCount >= expected
    const diff = Math.max(0, expected - matchCount)
    checks.push({
      label: `First-round fixtures scheduled (${matchCount}/${expected})`,
      ok: fixturesOk,
      detail: fixturesOk ? undefined : `Schedule ${diff} more fixture${diff !== 1 ? 's' : ''}`,
    })
  }

  return checks
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  tournament: Tournament
  teams: TeamWithPlayers[]
  matches: MatchWithTeams[]
  onLive: () => void
}

export function GoLivePanel({ tournament, teams, matches, onLive }: Props) {
  const [isPending, startTransition] = useTransition()
  const checks = computeChecks(tournament, teams, matches)
  const allOk = checks.every(c => c.ok)

  function handleGoLive() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        await goLive(supabase, tournament.id)
        toast.success('Tournament is now live!')
        onLive()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to go live')
      }
    })
  }

  if (tournament.status === 'active') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-green-700">Tournament is Live</p>
        <p className="text-xs text-green-600 mt-1">Matches can be started from the Overview tab.</p>
      </div>
    )
  }

  if (tournament.status !== 'setup') return null

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-base font-bold text-slate-900 mb-3">Go Live</h3>
      <ul className="space-y-2 mb-4">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 text-base ${c.ok ? 'text-green-500' : 'text-red-400'}`}>
              {c.ok ? '✓' : '✗'}
            </span>
            <div>
              <span className={c.ok ? 'text-slate-700' : 'text-red-600 font-medium'}>{c.label}</span>
              {c.detail && <span className="text-xs text-red-500 ml-1">— {c.detail}</span>}
            </div>
          </li>
        ))}
      </ul>
      <button
        onClick={handleGoLive}
        disabled={!allOk || isPending}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          allOk
            ? 'bg-green-600 hover:bg-green-500 text-white'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isPending ? 'Going Live…' : allOk ? 'Go Live' : 'Cannot Go Live Yet'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Do NOT commit yet**

`OverviewTab.tsx` does not pass `matches` to `GoLivePanel` yet — typecheck will fail until Task 7 fixes it. Proceed directly to Task 7.

---

### Task 7: Update OverviewTab

**Files:**
- Modify: `web/app/admin/tournaments/[id]/OverviewTab.tsx`

- [ ] **Step 1: Replace OverviewTab.tsx**

Replace the entire content of `web/app/admin/tournaments/[id]/OverviewTab.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { finishTournament, endGroupStage } from '@/lib/db/tournaments'
import { MatchStatusControls } from './MatchStatusControls'
import { ScoreEditor } from './ScoreEditor'
import { OrganizerAssignment } from './OrganizerAssignment'
import { GoLivePanel } from './GoLivePanel'
import type { Tournament, MatchWithTeams, TeamWithPlayers, TournamentStatus } from '@/lib/supabase/types'

function statusLabel(status: TournamentStatus): string {
  const labels: Record<TournamentStatus, string> = {
    setup: 'Setup',
    active: 'Active',
    bracket_setup: 'Bracket Setup',
    knockout: 'Knockout',
    finished: 'Finished',
    archived: 'Archived',
  }
  return labels[status]
}

interface Props {
  tournament: Tournament
  matches: MatchWithTeams[]
  teams: TeamWithPlayers[]
  tournamentId: string
  isAdmin: boolean
  isOrganizer: boolean
  onRefresh: () => void
}

export function OverviewTab({ tournament: t, matches, teams, tournamentId, isAdmin, isOrganizer, onRefresh }: Props) {
  const liveCount = matches.filter(m => m.status === 'live').length
  // FinishPanel: show during knockout phase, or active phase for non-hybrid formats
  const showFinishPanel = t.status === 'knockout' ||
    (t.status === 'active' && t.format !== 'round_robin_knockout')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Status" value={statusLabel(t.status)} />
        <StatCard label="Matches" value={matches.length} />
        <StatCard label="Live Now" value={liveCount} highlight={liveCount > 0} />
        <StatCard label="Format" value={
          t.format === 'round_robin' ? 'Round Robin' :
          t.format === 'round_robin_knockout' ? 'RR + Knockout' :
          'Knockout'
        } />
      </div>

      <GoLivePanel tournament={t} teams={teams} matches={matches} onLive={onRefresh} />

      {t.format === 'round_robin_knockout' && t.status === 'active' && (
        <EndGroupStagePanel matches={matches} tournamentId={tournamentId} onEnded={onRefresh} />
      )}

      {isAdmin && <OrganizerAssignment tournamentId={tournamentId} />}

      {showFinishPanel && (
        <FinishPanel tournamentId={tournamentId} onFinished={onRefresh} />
      )}

      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-3">Matches</h2>
        {matches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <p className="text-slate-500">No fixtures yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map(m => (
              <MatchRow key={m.id} match={m} tournamentId={tournamentId} isOrganizer={isOrganizer} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function EndGroupStagePanel({
  matches,
  tournamentId,
  onEnded,
}: {
  matches: MatchWithTeams[]
  tournamentId: string
  onEnded: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const allFinished = matches.length > 0 && matches.every(m => m.status === 'finished')

  function handleEnd() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        await endGroupStage(supabase, tournamentId)
        toast.success('Group stage ended. Set up the knockout bracket.')
        onEnded()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to end group stage')
      }
    })
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-base font-bold text-slate-900 mb-2">End Group Stage</h3>
      <p className="text-sm text-slate-500 mb-4">
        {allFinished
          ? 'All group matches are finished. You can now set up the knockout bracket.'
          : 'All group matches must be finished before ending the group stage.'}
      </p>
      <button
        onClick={handleEnd}
        disabled={!allFinished || isPending}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
          allFinished
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {isPending ? 'Processing…' : allFinished ? 'End Group Stage & Set Up Bracket' : 'Complete all group matches first'}
      </button>
    </div>
  )
}

function FinishPanel({ tournamentId, onFinished }: { tournamentId: string; onFinished: () => void }) {
  const [isPending, startTransition] = useTransition()

  function finish() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        await finishTournament(supabase, tournamentId)
        toast.success('Tournament marked as finished.')
        onFinished()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to finish tournament')
      }
    })
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-amber-800">All matches done?</p>
        <p className="text-xs text-amber-600">Marking as finished locks all editing.</p>
      </div>
      <button onClick={finish} disabled={isPending}
        className="bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
        {isPending ? 'Finishing…' : 'Mark as Finished'}
      </button>
    </div>
  )
}

function MatchRow({ match: m, tournamentId, isOrganizer, isAdmin }:
  { match: MatchWithTeams; tournamentId: string; isOrganizer: boolean; isAdmin: boolean }) {
  const matchTime = new Date(m.match_time).toLocaleString('en-MY', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const statusColors: Record<string, string> = {
    scheduled: 'bg-slate-100 text-slate-500',
    live: 'bg-green-100 text-green-700',
    halftime: 'bg-amber-100 text-amber-700',
    finished: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-sm">{m.home_team.name} vs {m.away_team.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{matchTime}</p>
      </div>
      {m.status === 'live' && isOrganizer ? (
        <ScoreEditor
          matchId={m.id}
          homeScore={m.home_score}
          awayScore={m.away_score}
          homeName={m.home_team.name}
          awayName={m.away_team.name}
        />
      ) : m.status !== 'scheduled' && (
        <span className="text-base font-bold tabular-nums">{m.home_score} – {m.away_score}</span>
      )}
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusColors[m.status]}`}>
        {m.status}
      </span>
      {isOrganizer && (
        <MatchStatusControls match={m} tournamentId={tournamentId} isAdmin={isAdmin} />
      )}
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${highlight ? 'border-green-400' : 'border-slate-200'}`}>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${highlight ? 'text-green-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
cd web && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit both GoLivePanel and OverviewTab together**

```bash
git add web/app/admin/tournaments/\[id\]/GoLivePanel.tsx web/app/admin/tournaments/\[id\]/OverviewTab.tsx
git commit -m "feat: add fixture completeness check to GoLivePanel; add EndGroupStagePanel and knockout support to OverviewTab"
```

---

### Task 8: Update TabStrip and callers

**Files:**
- Modify: `web/app/admin/tournaments/[id]/TabStrip.tsx`
- Modify: `web/app/admin/tournaments/[id]/page.tsx`
- Modify: `web/app/admin/tournaments/[id]/setup/layout.tsx`

- [ ] **Step 1: Replace TabStrip.tsx**

Replace the entire content of `web/app/admin/tournaments/[id]/TabStrip.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

interface TabDef {
  segment: string
  label: string
}

const BASE_TABS: TabDef[] = [
  { segment: '', label: 'Overview' },
  { segment: 'setup/teams', label: 'Teams' },
  { segment: 'setup/fixtures', label: 'Fixtures' },
  { segment: 'setup/settings', label: 'Settings' },
]

const BRACKET_TAB: TabDef = { segment: 'setup/bracket', label: 'Bracket' }

interface Props {
  teamsAlert?: boolean
  showBracketTab?: boolean
}

export function TabStrip({ teamsAlert = false, showBracketTab = false }: Props) {
  const { id } = useParams() as { id: string }
  const pathname = usePathname()
  const basePath = `/admin/tournaments/${id}`
  const tabs = showBracketTab ? [...BASE_TABS, BRACKET_TAB] : BASE_TABS

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto flex">
        {tabs.map(tab => {
          const href = tab.segment ? `${basePath}/${tab.segment}` : basePath
          const isActive = tab.segment === ''
            ? pathname === basePath
            : pathname.endsWith(`/${tab.segment}`)
          return (
            <Link
              key={tab.segment || 'overview'}
              href={href}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                isActive ? 'text-green-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.segment === 'setup/teams' && teamsAlert && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update page.tsx**

In `web/app/admin/tournaments/[id]/page.tsx`, find `<TabStrip teamsAlert={teamsAlert} />` and replace with:

```tsx
<TabStrip
  teamsAlert={teamsAlert}
  showBracketTab={tournament.format === 'round_robin_knockout' && tournament.status === 'bracket_setup'}
/>
```

- [ ] **Step 3: Update setup/layout.tsx**

In `web/app/admin/tournaments/[id]/setup/layout.tsx`, find `<TabStrip />` and replace with:

```tsx
<TabStrip
  showBracketTab={tournament.format === 'round_robin_knockout' && tournament.status === 'bracket_setup'}
/>
```

- [ ] **Step 4: Run typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/TabStrip.tsx web/app/admin/tournaments/\[id\]/page.tsx web/app/admin/tournaments/\[id\]/setup/layout.tsx
git commit -m "feat(TabStrip): add conditional Bracket tab for round_robin_knockout bracket_setup state"
```

---

### Task 9: Bracket seeding page

**Files:**
- Create: `web/app/admin/tournaments/[id]/setup/bracket/page.tsx`

- [ ] **Step 1: Create the bracket seeding page**

Create `web/app/admin/tournaments/[id]/setup/bracket/page.tsx`:

```tsx
'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/Toast'
import { createClient } from '@/lib/supabase/client'
import { startKnockoutPhase } from '@/lib/db/tournaments'
import { createMatch } from '@/lib/db/matches'
import { getTournamentStandings } from '@/lib/db/standings'
import { expectedFirstRoundKOMatches } from '@/lib/fixture-utils'
import { useSetup } from '../SetupContext'
import type { Standing } from '@/lib/supabase/types'

type Slot = { home_team_id: string; away_team_id: string; match_date: string; match_time: string }

function emptySlot(): Slot {
  return { home_team_id: '', away_team_id: '', match_date: '', match_time: '' }
}

const sel = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export default function BracketSetupPage() {
  const { tournament, teams } = useSetup()
  const router = useRouter()
  const [standings, setStandings] = useState<Standing[]>([])
  const [isPending, startTransition] = useTransition()
  const numSlots = expectedFirstRoundKOMatches(tournament.knockout_start_round)
  const [slots, setSlots] = useState<Slot[]>(() => Array.from({ length: numSlots }, emptySlot))

  useEffect(() => {
    if (tournament.status !== 'bracket_setup') {
      router.replace(`/admin/tournaments/${tournament.id}`)
    }
  }, [tournament.status, tournament.id, router])

  useEffect(() => {
    const supabase = createClient()
    getTournamentStandings(supabase, tournament.id).then(setStandings).catch(() => {})
  }, [tournament.id])

  function updateSlot(i: number, field: keyof Slot, value: string) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  const allFilled = slots.length > 0 && slots.every(
    s => s.home_team_id && s.away_team_id && s.match_date && s.match_time && s.home_team_id !== s.away_team_id
  )

  function handleConfirm() {
    startTransition(async () => {
      const supabase = createClient()
      try {
        for (const slot of slots) {
          await createMatch(
            supabase,
            tournament.id,
            slot.home_team_id,
            slot.away_team_id,
            new Date(`${slot.match_date}T${slot.match_time}`).toISOString(),
          )
        }
        await startKnockoutPhase(supabase, tournament.id)
        toast.success('Knockout phase started!')
        router.push(`/admin/tournaments/${tournament.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start knockout phase')
      }
    })
  }

  if (tournament.status !== 'bracket_setup') return null

  return (
    <div className="space-y-6">
      {standings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-bold mb-3">Group Stage Standings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="text-left pb-2 pr-4">Team</th>
                  <th className="text-center pb-2 px-2">P</th>
                  <th className="text-center pb-2 px-2">W</th>
                  <th className="text-center pb-2 px-2">D</th>
                  <th className="text-center pb-2 px-2">L</th>
                  <th className="text-center pb-2 px-2">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {standings.map(s => (
                  <tr key={s.team_id}>
                    <td className="py-1.5 font-medium pr-4">{s.team_name}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.matches_played}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.wins}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.draws}</td>
                    <td className="text-center py-1.5 px-2 text-slate-500">{s.losses}</td>
                    <td className="text-center py-1.5 px-2 font-semibold">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-bold mb-1">Knockout First Round</h2>
        <p className="text-sm text-slate-500 mb-4">
          Assign teams to all {numSlots} first-round {numSlots === 1 ? 'match' : 'matches'} to start the knockout phase.
        </p>
        <div className="space-y-4">
          {slots.map((slot, i) => (
            <div key={i} className="border border-slate-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-slate-500 mb-3">Match {i + 1}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Home Team</label>
                  <select
                    value={slot.home_team_id}
                    onChange={e => updateSlot(i, 'home_team_id', e.target.value)}
                    className={sel}
                  >
                    <option value="">Select…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Away Team</label>
                  <select
                    value={slot.away_team_id}
                    onChange={e => updateSlot(i, 'away_team_id', e.target.value)}
                    className={sel}
                  >
                    <option value="">Select…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                  <input
                    type="date"
                    value={slot.match_date}
                    onChange={e => updateSlot(i, 'match_date', e.target.value)}
                    className={sel}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Time</label>
                  <input
                    type="time"
                    value={slot.match_time}
                    onChange={e => updateSlot(i, 'match_time', e.target.value)}
                    className={sel}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={handleConfirm}
          disabled={!allFilled || isPending}
          className={`mt-6 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            allFilled
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isPending ? 'Starting Knockout Phase…' : allFilled ? 'Confirm Bracket & Start Knockout Phase' : 'Fill all slots to continue'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd web && tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
cd web && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/setup/bracket/page.tsx
git commit -m "feat(bracket): add bracket seeding page for round_robin_knockout tournaments"
```

---

### Task 10: Update schema documentation

**Files:**
- Modify: `docs/backend/schema.md`

- [ ] **Step 1: Update the Tournament Lifecycle section**

In `docs/backend/schema.md`, find the Tournament Lifecycle subsection and replace the status table with:

```markdown
| Status | Meaning |
|---|---|
| `setup` | Being configured by admin. Teams and rosters are being set up; matches can be scheduled. Not shown on the public homepage. |
| `active` | Live and in progress — group stage running. Shown on the public homepage. |
| `bracket_setup` | Group stage finished; organizer is manually seeding the knockout bracket. Shown on the public homepage. Only applies to `round_robin_knockout` format. |
| `knockout` | Knockout phase running. Shown on the public homepage. Only applies to `round_robin_knockout` format. |
| `finished` | Tournament concluded. Results are final. Not shown on the public homepage. |
| `archived` | Retired. Not shown on the public homepage. |
```

Also update the lifecycle flow line to show both paths:

```markdown
**Round-robin / Knockout only:** `setup → active → finished → archived`

**Round-robin + Knockout:** `setup → active → bracket_setup → knockout → finished → archived`
```

- [ ] **Step 2: Commit**

```bash
git add docs/backend/schema.md
git commit -m "docs(schema): update tournament lifecycle to include bracket_setup and knockout statuses"
```
