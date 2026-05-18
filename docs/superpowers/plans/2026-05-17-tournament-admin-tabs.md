# Tabbed Admin Tournament Detail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/admin/tournaments/[id]` from a flat server component with link navigation into a single client-side tabbed page (Overview, Teams, Fixtures, Settings) with Go Live readiness checks and team initialization indicators.

**Architecture:** Single `'use client'` page component with React `useState` for tab switching. All data loaded client-side via Supabase. Each tab is an inline component sharing the same data state. Existing sub-pages become dead routes.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS v4, Supabase (client-side)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `web/supabase/migrations/20260517000000_min_players_per_team.sql` | Create | Add `min_players_per_team` column |
| `web/lib/supabase/types.ts` | Modify | Add field to Tournament type |
| `web/app/admin/tournaments/[id]/page.tsx` | Rewrite | Client component with tab shell |
| `web/app/admin/tournaments/[id]/TabStrip.tsx` | Create | Tab bar with red indicator |
| `web/app/admin/tournaments/[id]/OverviewTab.tsx` | Create | Stats, matches, Go Live |
| `web/app/admin/tournaments/[id]/TeamsTab.tsx` | Create | Team list + roster editor |
| `web/app/admin/tournaments/[id]/FixturesTab.tsx` | Create | Fixture scheduling |
| `web/app/admin/tournaments/[id]/SettingsTab.tsx` | Create | All config fields + scorekeepers |
| `web/app/admin/tournaments/[id]/GoLivePanel.tsx` | Create | Go Live button + checklist |

Reused unchanged: `MatchStatusControls.tsx`, `ScoreEditor.tsx`, `OrganizerAssignment.tsx`

---

### Task 1: Database migration — add `min_players_per_team`

**Files:**
- Create: `web/supabase/migrations/20260517000000_min_players_per_team.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Add min_players_per_team to tournaments
ALTER TABLE tournaments
  ADD COLUMN min_players_per_team INTEGER NOT NULL DEFAULT 11
  CHECK (min_players_per_team >= 11);
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
cd web && npx supabase migration up
```
Expected: migration applied successfully

- [ ] **Step 3: Commit**

```bash
git add web/supabase/migrations/20260517000000_min_players_per_team.sql
git commit -m "feat: add min_players_per_team to tournaments"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `web/lib/supabase/types.ts`

- [ ] **Step 1: Add `min_players_per_team` to Tournament interface**

Add this field after `seeding_method` in the `Tournament` interface (line ~34):

```typescript
  min_players_per_team: number
```

Also note: the file has duplicate type declarations for `KnockoutStartRound` and `SeedingMethod` (lines 5-6 and 8-9). Don't touch those — they're pre-existing.

The full `Tournament` interface should read (showing only the changed section):

```typescript
export interface Tournament {
  id: string
  name: string
  description: string | null
  location: string | null
  start_date: string
  end_date: string
  format: TournamentFormat
  points_win: number
  points_draw: number
  points_loss: number
  status: TournamentStatus
  first_match_scheduled_at: string | null
  halftime_enabled: boolean
  minutes_per_half: number
  halftime_minutes: number | null
  extra_time_minutes: number | null
  penalty_shootout_enabled: boolean
  require_goal_player: boolean
  num_groups: number | null
  teams_per_group: number | null
  advance_per_group: number | null
  knockout_start_round: KnockoutStartRound | null
  seeding_method: SeedingMethod | null
  min_players_per_team: number        // <-- NEW
  created_at: string
  updated_at: string
  // (existing duplicate fields below stay as-is)
  halftime_enabled: boolean
  minutes_per_half: number
  halftime_minutes: number | null
  extra_time_minutes: number | null
  penalty_shootout_enabled: boolean
  require_goal_player: boolean
  num_groups: number | null
  teams_per_group: number | null
  advance_per_group: number | null
  knockout_start_round: KnockoutStartRound | null
  seeding_method: SeedingMethod | null
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors related to `min_players_per_team`

- [ ] **Step 3: Commit**

```bash
git add web/lib/supabase/types.ts
git commit -m "feat: add min_players_per_team to Tournament type"
```

---

### Task 3: Create TabStrip component

**Files:**
- Create: `web/app/admin/tournaments/[id]/TabStrip.tsx`

- [ ] **Step 1: Write TabStrip component**

```tsx
'use client'

export type TabId = 'overview' | 'teams' | 'fixtures' | 'settings'

interface TabDef {
  id: TabId
  label: string
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'teams', label: 'Teams' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'settings', label: 'Settings' },
]

interface Props {
  active: TabId
  onChange: (id: TabId) => void
  teamsAlert: boolean
}

export function TabStrip({ active, onChange, teamsAlert }: Props) {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="max-w-5xl mx-auto flex">
        {TABS.map(tab => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-green-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                {tab.id === 'teams' && teamsAlert && (
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                )}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/TabStrip.tsx
git commit -m "feat: add TabStrip component with red indicator"
```

---

### Task 4: Create GoLivePanel component

**Files:**
- Create: `web/app/admin/tournaments/[id]/GoLivePanel.tsx`

- [ ] **Step 1: Write GoLivePanel component**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import type { Tournament, TeamWithPlayers } from '@/lib/supabase/types'

interface GoLiveCheck {
  label: string
  ok: boolean
  detail?: string
}

function computeChecks(t: Tournament, teams: TeamWithPlayers[]): GoLiveCheck[] {
  const checks: GoLiveCheck[] = []

  // 1. Settings configured
  const hasRR = t.format === 'round_robin' || t.format === 'round_robin_knockout'
  const hasKO = t.format === 'knockout' || t.format === 'round_robin_knockout'
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
    detail: teamsOk ? undefined : `Add ${expectedTeams - teams.length} more team${expectedTeams - teams.length !== 1 ? 's' : ''}`,
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
    label: `Tournament date reached`,
    ok: dateOk,
    detail: dateOk ? undefined : `Wait until ${formatDate(t.start_date)}`,
  })

  return checks
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface Props {
  tournament: Tournament
  teams: TeamWithPlayers[]
  onLive: () => void
}

export function GoLivePanel({ tournament, teams, onLive }: Props) {
  const [isPending, startTransition] = useTransition()
  const checks = computeChecks(tournament, teams)
  const allOk = checks.every(c => c.ok)

  function goLive() {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase
        .from('tournaments')
        .update({ status: 'active' })
        .eq('id', tournament.id)
      if (error) { toast.error(error.message); return }
      toast.success('Tournament is now live!')
      onLive()
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
        onClick={goLive}
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

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/GoLivePanel.tsx
git commit -m "feat: add GoLivePanel with readiness checklist"
```

---

### Task 5: Create OverviewTab component

**Files:**
- Create: `web/app/admin/tournaments/[id]/OverviewTab.tsx`

- [ ] **Step 1: Write OverviewTab component**

This component extracts the existing overview content from the current `page.tsx` (stat cards, matches list, match controls) and adds the GoLivePanel. It receives all data as props from the parent.

```tsx
'use client'

import Link from 'next/link'
import { MatchStatusControls } from './MatchStatusControls'
import { ScoreEditor } from './ScoreEditor'
import { OrganizerAssignment } from './OrganizerAssignment'
import { GoLivePanel } from './GoLivePanel'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Status" value={<span className="capitalize">{t.status}</span>} />
        <StatCard label="Matches" value={matches.length} />
        <StatCard label="Live Now" value={liveCount} highlight={liveCount > 0} />
        <StatCard label="Format" value={
          t.format === 'round_robin' ? 'Round Robin' :
          t.format === 'round_robin_knockout' ? 'RR + Knockout' :
          'Knockout'
        } />
      </div>

      <GoLivePanel tournament={t} teams={teams} onLive={onRefresh} />

      {isAdmin && <OrganizerAssignment tournamentId={tournamentId} />}

      {t.status === 'active' && (
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
              <MatchRow key={m.id} match={m} tournamentId={tournamentId} isOrganizer={isOrganizer} isAdmin={isAdmin} onRefresh={onRefresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function FinishPanel({ tournamentId, onFinished }: { tournamentId: string; onFinished: () => void }) {
  const [isPending, start] = require('react').useTransition()

  function finish() {
    start(async () => {
      const { createClient } = require('@/lib/supabase/client')
      const { toast } = require('@/components/Toast')
      const supabase = createClient()
      const { error } = await supabase.from('tournaments').update({ status: 'finished' }).eq('id', tournamentId)
      if (error) { toast.error(error.message); return }
      toast.success('Tournament marked as finished.')
      onFinished()
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

function MatchRow({ match: m, tournamentId, isOrganizer, isAdmin, onRefresh }:
  { match: MatchWithTeams; tournamentId: string; isOrganizer: boolean; isAdmin: boolean; onRefresh: () => void }) {
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

Note: The `FinishPanel` uses inline `require()` for `useTransition` and `toast` — rewrite to proper top-level imports:

```tsx
import { useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
```

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/OverviewTab.tsx
git commit -m "feat: add OverviewTab with matches, stats, Go Live"
```

---

### Task 6: Create TeamsTab component

**Files:**
- Create: `web/app/admin/tournaments/[id]/TeamsTab.tsx`

- [ ] **Step 1: Write TeamsTab component**

Port the logic from the existing `teams/page.tsx` into an inline component. Add the red indicator for under-rostered teams.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import { canManageTeams } from '@/lib/lock-rules'
import type { TeamWithPlayers, TournamentStatus } from '@/lib/supabase/types'

interface Props {
  teams: TeamWithPlayers[]
  tournamentStatus: TournamentStatus
  tournamentId: string
  minPlayers: number
  onRefresh: () => void
}

export function TeamsTab({ teams, tournamentStatus, tournamentId, minPlayers, onRefresh }: Props) {
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const teamsLocked = !canManageTeams(tournamentStatus)
  const activeTeam = teams.find(t => t.id === selectedTeam)

  function addTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('teams').insert({ tournament_id: tournamentId, name: newTeamName.trim() })
      if (error) { toast.error(error.message); return }
      setNewTeamName('')
      toast.success(`Team "${newTeamName.trim()}" added!`)
      onRefresh()
    })
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h2 className="text-base font-bold mb-3">Teams ({teams.length})</h2>
        {teamsLocked && (
          <p className="text-xs text-amber-600 mb-3">Team and roster changes are locked once the tournament is active.</p>
        )}
        <form onSubmit={addTeam} className="flex gap-2 mb-4">
          <input type="text" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team name"
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <button type="submit" disabled={isPending || !newTeamName.trim() || teamsLocked}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            Add
          </button>
        </form>
        {teams.length === 0 ? (
          <p className="text-center text-slate-400 py-8">No teams yet.</p>
        ) : (
          <div className="space-y-2">
            {teams.map(t => {
              const isUnder = t.players.length < minPlayers
              return (
                <button key={t.id} onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)}
                  className={`w-full text-left bg-white rounded-xl border px-4 py-3 flex items-center justify-between transition-colors ${
                    selectedTeam === t.id ? 'border-green-500 ring-1 ring-green-500' :
                    isUnder ? 'border-red-300 bg-red-50 hover:border-red-400' :
                    'border-slate-200 hover:border-slate-300'
                  }`}>
                  <div>
                    <p className="font-medium text-slate-900 flex items-center gap-2">
                      {t.name}
                      {isUnder && <span className="text-red-500 text-xs font-semibold">⚠ {t.players.length}/{minPlayers}</span>}
                    </p>
                    <p className={`text-xs ${isUnder ? 'text-red-400' : 'text-slate-400'}`}>
                      {isUnder ? `Need ${minPlayers - t.players.length} more player${minPlayers - t.players.length !== 1 ? 's' : ''}` : `${t.players.length} players`}
                    </p>
                  </div>
                  <span className="text-slate-400 text-sm">{selectedTeam === t.id ? '▲' : '▼'}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div>
        {activeTeam ? (
          <RosterEditor team={activeTeam} onUpdate={onRefresh} locked={teamsLocked} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <p>Select a team to edit its roster.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RosterEditor({ team, onUpdate, locked }: { team: TeamWithPlayers; onUpdate: () => void; locked: boolean }) {
  const [form, setForm] = useState({ name: '', jersey_number: '', position: '' })
  const [isPending, startTransition] = useTransition()
  const sorted = [...team.players].sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999))

  function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('players').insert({
        team_id: team.id, name: form.name.trim(),
        jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
        position: form.position.trim() || null,
      })
      if (error) { toast.error(error.message); return }
      setForm({ name: '', jersey_number: '', position: '' })
      toast.success('Player added!')
      onUpdate()
    })
  }

  function removePlayer(playerId: string) {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('players').delete().eq('id', playerId)
      onUpdate()
    })
  }

  return (
    <div>
      <h2 className="text-base font-bold mb-3">Roster: {team.name}</h2>
      <form onSubmit={addPlayer} className="bg-white rounded-xl border border-slate-200 p-4 mb-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input type="number" value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))}
            placeholder="#" min="1" max="99" className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Player name *" required className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <input type="text" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
          placeholder="Position (e.g. GK, DEF)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        <button type="submit" disabled={isPending || !form.name.trim() || locked}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
          Add Player
        </button>
      </form>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-400 py-6 text-sm">No players yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-xs">
                <th className="px-4 py-2 text-left w-10">#</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Pos</th>
                <th className="px-4 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2 tabular-nums text-slate-400">{p.jersey_number ?? '—'}</td>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-slate-500">{p.position ?? '—'}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => removePlayer(p.id)} disabled={isPending || locked} className="text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/TeamsTab.tsx
git commit -m "feat: add TeamsTab with roster editor and red indicators"
```

---

### Task 7: Create FixturesTab component

**Files:**
- Create: `web/app/admin/tournaments/[id]/FixturesTab.tsx`

- [ ] **Step 1: Write FixturesTab component**

Port the logic from `fixtures/page.tsx` into an inline component.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import { canAddFixture, canDeleteFixture, canEditMatchTime } from '@/lib/lock-rules'
import type { Team, MatchWithTeams, TournamentStatus } from '@/lib/supabase/types'

function statusPill(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    scheduled: { label: 'Scheduled', classes: 'bg-slate-100 text-slate-600' },
    live: { label: 'Live', classes: 'bg-green-100 text-green-700' },
    halftime: { label: 'Halftime', classes: 'bg-amber-100 text-amber-700' },
    finished: { label: 'Finished', classes: 'bg-blue-50 text-blue-600' },
  }
  const s = map[status] ?? { label: status, classes: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${s.classes}`}>{s.label}</span>
  )
}

interface Props {
  teams: Team[]
  matches: MatchWithTeams[]
  tournamentStatus: TournamentStatus
  tournamentId: string
  onRefresh: () => void
}

export function FixturesTab({ teams, matches, tournamentStatus, tournamentId, onRefresh }: Props) {
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', match_time: '' })
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editingTime, setEditingTime] = useState('')

  function validateForm(): string[] {
    const errors: string[] = []
    if (form.home_team_id === form.away_team_id) errors.push('A team cannot play against itself.')
    if (form.home_team_id && form.away_team_id && form.match_time) {
      const newTime = new Date(form.match_time).getTime()
      const clash = matches.some(m => {
        if (m.status !== 'scheduled') return false
        const existing = new Date(m.match_time).getTime()
        return Math.abs(newTime - existing) < 3600000 &&
          (m.home_team_id === form.home_team_id || m.away_team_id === form.home_team_id ||
           m.home_team_id === form.away_team_id || m.away_team_id === form.away_team_id)
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
      const supabase = createClient()
      const { error } = await supabase.from('matches').insert({
        tournament_id: tournamentId,
        home_team_id: form.home_team_id,
        away_team_id: form.away_team_id,
        match_time: new Date(form.match_time).toISOString(),
      })
      if (error) { toast.error(error.message); return }
      setForm({ home_team_id: '', away_team_id: '', match_time: '' })
      setFormErrors([])
      toast.success('Fixture scheduled!')
      onRefresh()
    })
  }

  function deleteFixture(matchId: string) {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('matches').delete().eq('id', matchId)
      toast.success('Fixture removed.')
      onRefresh()
    })
  }

  function startEditTime(match: MatchWithTeams) {
    if (!canEditMatchTime(tournamentStatus, match.status)) return
    setEditingMatchId(match.id)
    setEditingTime(new Date(match.match_time).toISOString().slice(0, 16))
  }

  function saveEditTime() {
    if (!editingMatchId) return
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('matches')
        .update({ match_time: new Date(editingTime).toISOString() })
        .eq('id', editingMatchId)
      if (error) { toast.error(error.message); return }
      setEditingMatchId(null)
      setEditingTime('')
      toast.success('Match time updated.')
      onRefresh()
    })
  }

  const fixturesLocked = !canAddFixture(tournamentStatus)
  const sel = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const selError = 'w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50'

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-base font-bold mb-4">Schedule a Match</h2>
        {fixturesLocked && (
          <p className="text-xs text-amber-600 mb-3">Fixture changes are locked once the tournament is finished.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date & Time</label>
                <input type="datetime-local" value={form.match_time} onChange={e => { setForm(f => ({ ...f, match_time: e.target.value })); setFormErrors([]) }} required className={formErrors.length > 0 ? selError : sel} />
              </div>
              <button type="submit" disabled={isPending || fixturesLocked} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg text-sm h-fit sm:self-end">
                {isPending ? 'Scheduling…' : 'Schedule Match'}
              </button>
            </div>
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

      <div>
        <h2 className="text-base font-bold mb-3">All Matches ({matches.length})</h2>
        {matches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No fixtures yet.</div>
        ) : (
          <div className="space-y-2">
            {matches.map(m => {
              const canDelete = canDeleteFixture(tournamentStatus)
              const canEdit = canEditMatchTime(tournamentStatus, m.status)
              const isEditing = editingMatchId === m.id
              return (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                    <p className="font-medium text-sm whitespace-nowrap">{m.home_team.name} vs {m.away_team.name}</p>
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input type="datetime-local" value={editingTime} onChange={e => setEditingTime(e.target.value)}
                          className="w-44 border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" autoFocus />
                        <button onClick={saveEditTime} disabled={isPending} className="text-green-600 hover:text-green-700 text-xs font-semibold disabled:opacity-30">Save</button>
                        <button onClick={() => { setEditingMatchId(null); setEditingTime('') }} className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
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
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/FixturesTab.tsx
git commit -m "feat: add FixturesTab with scheduling and match time editing"
```

---

### Task 8: Create SettingsTab component

**Files:**
- Create: `web/app/admin/tournaments/[id]/SettingsTab.tsx`

- [ ] **Step 1: Write SettingsTab component**

Port the edit form from `edit/page.tsx` plus the setup card from `TournamentSetupCard.tsx` plus scorekeepers from `scorekeepers/page.tsx` into one unified Settings tab.

```tsx
'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import {
  canEditTournamentName,
  canEditVenueDescription,
  canEditDates,
  canEditFormat,
  canEditTournamentMeta,
} from '@/lib/lock-rules'
import type { Tournament, TournamentFormat, MatchWithTeams } from '@/lib/supabase/types'

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

const FORMAT_OPTIONS = [
  { value: 'round_robin', label: 'Round Robin (League)' },
  { value: 'round_robin_knockout', label: 'Round Robin + Knockout Rounds' },
  { value: 'knockout', label: 'Knockout Only' },
]

interface Props {
  tournament: Tournament
  matches: MatchWithTeams[]
  tournamentId: string
  isAdmin: boolean
  onRefresh: () => void
}

export function SettingsTab({ tournament: t, matches, tournamentId, isAdmin, onRefresh }: Props) {
  const [form, setForm] = useState({
    name: t.name,
    description: t.description ?? '',
    location: t.location ?? '',
    start_date: t.start_date,
    end_date: t.end_date,
    format: t.format,
    points_win: t.points_win,
    points_draw: t.points_draw,
    points_loss: t.points_loss,
    halftime_enabled: t.halftime_enabled,
    minutes_per_half: t.minutes_per_half,
    halftime_minutes: t.halftime_minutes ?? '' as number | '',
    extra_time_minutes: t.extra_time_minutes ?? '' as number | '',
    penalty_shootout_enabled: t.penalty_shootout_enabled,
    require_goal_player: t.require_goal_player,
    num_groups: t.num_groups ?? '' as number | '',
    teams_per_group: t.teams_per_group ?? '' as number | '',
    advance_per_group: t.advance_per_group ?? '' as number | '',
    knockout_start_round: t.knockout_start_round ?? '',
    seeding_method: t.seeding_method ?? '',
    min_players_per_team: t.min_players_per_team,
  })
  const [isPending, startTransition] = useTransition()

  // Scorekeeper state
  interface ScorekeeperRow { user_id: string; email: string; match_id: string | null }
  const [scorekeepers, setScorekeepers] = useState<ScorekeeperRow[]>([])
  const [skEmail, setSkEmail] = useState('')
  const [skScope, setSkScope] = useState<'tournament' | 'match'>('tournament')
  const [skMatchId, setSkMatchId] = useState('')
  const [skPending, startSkTransition] = useTransition()

  const loadScorekeepers = useCallback(async () => {
    const res = await fetch(`/api/admin/scorekeepers?tournamentId=${tournamentId}`)
    if (res.ok) setScorekeepers(await res.json())
  }, [tournamentId])

  useEffect(() => { loadScorekeepers() }, [loadScorekeepers])

  function update(field: string, value: string | number | boolean) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function saveSettings() {
    if (form.end_date < form.start_date) { toast.error('End date cannot be before start date'); return }
    startTransition(async () => {
      const supabase = createClient()
      const nameLocked = !canEditTournamentName(t.status, t.start_date)
      const venueLocked = !canEditVenueDescription(t.status)
      const datesLocked = !canEditDates(t.status)
      const formatLocked = !canEditFormat(t.status, t.first_match_scheduled_at)
      const metaLocked = !canEditTournamentMeta(t.status)

      const patch: Record<string, unknown> = {}
      if (!nameLocked) patch.name = form.name
      if (!venueLocked) { patch.description = form.description || null; patch.location = form.location || null }
      if (!datesLocked) { patch.start_date = form.start_date; patch.end_date = form.end_date }
      if (!formatLocked) {
        patch.format = form.format
        patch.points_win = form.points_win
        patch.points_draw = form.points_draw
        patch.points_loss = form.points_loss
        patch.halftime_enabled = form.halftime_enabled
        patch.minutes_per_half = Number(form.minutes_per_half)
        patch.halftime_minutes = form.halftime_enabled ? Number(form.halftime_minutes) : null
        patch.extra_time_minutes = form.extra_time_minutes !== '' ? Number(form.extra_time_minutes) : null
        patch.penalty_shootout_enabled = form.penalty_shootout_enabled
        patch.require_goal_player = form.require_goal_player
        const hasRR = form.format === 'round_robin' || form.format === 'round_robin_knockout'
        const hasKO = form.format === 'knockout' || form.format === 'round_robin_knockout'
        const isHybrid = form.format === 'round_robin_knockout'
        patch.num_groups = hasRR ? Number(form.num_groups) : null
        patch.teams_per_group = hasRR ? Number(form.teams_per_group) : null
        patch.advance_per_group = isHybrid ? Number(form.advance_per_group) : null
        patch.knockout_start_round = hasKO ? form.knockout_start_round || null : null
        patch.seeding_method = hasKO ? form.seeding_method || null : null
      }
      if (metaLocked) {
        // min_players_per_team is always editable
      }
      patch.min_players_per_team = Number(form.min_players_per_team)

      if (Object.keys(patch).length === 0) { toast.error('All fields are locked.'); return }

      // Validate min_players
      if (Number(form.min_players_per_team) < 11) {
        toast.error('Minimum players per team must be at least 11')
        return
      }

      const { error } = await supabase.from('tournaments').update(patch).eq('id', tournamentId)
      if (error) { toast.error(error.message); return }
      toast.success('Settings saved!')
      onRefresh()
    })
  }

  function assignScorekeeper(e: React.FormEvent) {
    e.preventDefault()
    startSkTransition(async () => {
      const supabase = createClient()
      const { data: userId, error: userErr } = await supabase
        .rpc('get_user_id_by_email', { email_input: skEmail.trim().toLowerCase() })
      if (userErr || !userId) { toast.error('User not found. Make sure they have an account.'); return }
      const { error } = await supabase.from('user_roles').insert({
        user_id: userId, role: 'scorekeeper', tournament_id: tournamentId,
        match_id: skScope === 'match' && skMatchId ? skMatchId : null,
      })
      if (error) { toast.error(error.message); return }
      toast.success('Scorekeeper assigned!')
      setSkEmail(''); setSkMatchId('')
      await loadScorekeepers()
    })
  }

  function removeScorekeeper(userId: string, matchId: string | null) {
    startSkTransition(async () => {
      const supabase = createClient()
      let q = supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'scorekeeper').eq('tournament_id', tournamentId)
      q = matchId ? q.eq('match_id', matchId) : q.is('match_id', null)
      const { error } = await q
      if (error) { toast.error(error.message); return }
      toast.success('Scorekeeper removed.')
      await loadScorekeepers()
    })
  }

  const nameLocked = !canEditTournamentName(t.status, t.start_date)
  const venueLocked = !canEditVenueDescription(t.status)
  const datesLocked = !canEditDates(t.status)
  const formatLocked = !canEditFormat(t.status, t.first_match_scheduled_at)
  const hasRR = form.format === 'round_robin' || form.format === 'round_robin_knockout'
  const hasKO = form.format === 'knockout' || form.format === 'round_robin_knockout'
  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Lock warnings */}
      {venueLocked && !datesLocked && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-600">
          Venue and description are locked once the tournament goes live.
        </div>
      )}

      {/* Tournament Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Tournament Info</h3>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input type="text" value={form.name} onChange={e => update('name', e.target.value)} disabled={nameLocked} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} disabled={venueLocked} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Venue</label>
          <input type="text" value={form.location} onChange={e => update('location', e.target.value)} disabled={venueLocked} className={inputClass} />
        </div>
      </div>

      {/* Dates */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} disabled={datesLocked} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <input type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} disabled={datesLocked} min={form.start_date || undefined} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Format */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Format</h3>
        {formatLocked ? (
          <div>
            <input type="text" value={FORMAT_OPTIONS.find(o => o.value === form.format)?.label ?? form.format} disabled className={inputClass} />
            <p className="text-xs text-slate-400 mt-1">Locked once the first match is scheduled.</p>
          </div>
        ) : (
          <select value={form.format} onChange={e => update('format', e.target.value)} className={inputClass}>
            {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {hasRR && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of groups</label>
              <input type="number" min={1} value={form.num_groups} disabled={formatLocked}
                onChange={e => update('num_groups', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teams per group</label>
              <input type="number" min={2} value={form.teams_per_group} disabled={formatLocked}
                onChange={e => update('teams_per_group', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
            </div>
            {form.format === 'round_robin_knockout' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Teams advancing per group</label>
                <input type="number" min={1} value={form.advance_per_group} disabled={formatLocked}
                  onChange={e => update('advance_per_group', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
              </div>
            )}
          </div>
        )}
        {hasKO && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Knockout starts at</label>
              <select value={form.knockout_start_round} disabled={formatLocked} onChange={e => update('knockout_start_round', e.target.value)} className={inputClass}>
                <option value="">Select round</option>
                <option value="top_32">Top 32</option>
                <option value="top_16">Top 16</option>
                <option value="top_8">Top 8</option>
                <option value="semi">Semi-finals</option>
                <option value="final">Final</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Seeding method</label>
              <select value={form.seeding_method} disabled={formatLocked} onChange={e => update('seeding_method', e.target.value)} className={inputClass}>
                <option value="">Select method</option>
                <option value="by_standings">By standings</option>
                <option value="manual">Manual</option>
                <option value="random">Random</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Points */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Points System</h3>
        <div className="grid grid-cols-3 gap-4">
          {(['points_win', 'points_draw', 'points_loss'] as const).map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{field.replace('points_', '')}</label>
              <input type="number" step="0.5" value={form[field]} disabled={formatLocked}
                onChange={e => update(field, Number(e.target.value))} className={inputClass} />
            </div>
          ))}
        </div>
      </div>

      {/* Match Rules */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Match Rules</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Time per half (min)</label>
            <input type="number" min={1} value={form.minutes_per_half} disabled={formatLocked}
              onChange={e => update('minutes_per_half', Number(e.target.value))} className={inputClass} />
          </div>
          {form.halftime_enabled && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Halftime duration (min)</label>
              <input type="number" min={1} value={form.halftime_minutes} disabled={formatLocked}
                onChange={e => update('halftime_minutes', e.target.value === '' ? '' : Number(e.target.value))} className={inputClass} />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Extra time duration (min)</label>
          <input type="number" min={0} value={form.extra_time_minutes} disabled={formatLocked}
            onChange={e => update('extra_time_minutes', e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="0 or blank = none" className={inputClass} />
        </div>
        <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={form.penalty_shootout_enabled} disabled={formatLocked}
            onChange={e => update('penalty_shootout_enabled', e.target.checked)} className="accent-green-600" />
          <span className="text-sm text-slate-700">Penalty shootout as tiebreaker</span>
        </label>
        <label className={`flex items-center gap-3 ${formatLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
          <input type="checkbox" checked={form.require_goal_player} disabled={formatLocked}
            onChange={e => update('require_goal_player', e.target.checked)} className="accent-green-600" />
          <span className="text-sm text-slate-700">Require player attribution for goals</span>
        </label>
      </div>

      {/* Min Players */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-900">Minimum Players Per Team</h3>
        <input type="number" min={11} value={form.min_players_per_team}
          onChange={e => update('min_players_per_team', e.target.value === '' ? 11 : Math.max(11, Number(e.target.value)))}
          className={inputClass} />
        <p className="text-xs text-slate-400">Each team must have at least this many players before going live. Minimum: 11.</p>
      </div>

      <button onClick={saveSettings} disabled={isPending}
        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition-colors">
        {isPending ? 'Saving…' : 'Save Settings'}
      </button>

      {/* Scorekeepers */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Scorekeepers</h3>
          <form onSubmit={assignScorekeeper} className="space-y-3">
            <input type="email" value={skEmail} onChange={e => setSkEmail(e.target.value)} required
              placeholder="scorekeeper@example.com" className={inp} />
            <div className="flex gap-3">
              {(['tournament', 'match'] as const).map(s => (
                <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="sk-scope" value={s} checked={skScope === s} onChange={() => setSkScope(s)} className="accent-green-600" />
                  {s === 'tournament' ? 'Entire tournament' : 'Specific match'}
                </label>
              ))}
            </div>
            {skScope === 'match' && (
              <select value={skMatchId} onChange={e => setSkMatchId(e.target.value)} required className={inp}>
                <option value="">Select match…</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>{m.home_team.name} vs {m.away_team.name} — {new Date(m.match_time).toLocaleDateString('en-MY')}</option>
                ))}
              </select>
            )}
            <button type="submit" disabled={skPending} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm">
              {skPending ? 'Assigning…' : 'Assign Scorekeeper'}
            </button>
          </form>
          {scorekeepers.length > 0 && (
            <div className="space-y-2">
              {scorekeepers.map(sk => {
                const match = matches.find(m => m.id === sk.match_id)
                return (
                  <div key={`${sk.user_id}-${sk.match_id}`} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
                    <div>
                      <p className="text-sm text-slate-700">{sk.email}</p>
                      <p className="text-xs text-slate-400">
                        {sk.match_id && match ? `${match.home_team.name} vs ${match.away_team.name}` : 'Entire tournament'}
                      </p>
                    </div>
                    <button onClick={() => removeScorekeeper(sk.user_id, sk.match_id)} disabled={skPending}
                      className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/SettingsTab.tsx
git commit -m "feat: add SettingsTab with all config, min players, and scorekeepers"
```

---

### Task 9: Rewrite main page.tsx as client tab shell

**Files:**
- Rewrite: `web/app/admin/tournaments/[id]/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire server component with a client component that fetches data and renders tabs.

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TabStrip, type TabId } from './TabStrip'
import { OverviewTab } from './OverviewTab'
import { TeamsTab } from './TeamsTab'
import { FixturesTab } from './FixturesTab'
import { SettingsTab } from './SettingsTab'
import type { Tournament, MatchWithTeams, TeamWithPlayers, TournamentStatus } from '@/lib/supabase/types'

interface RoleInfo { role: string; tournament_id: string | null }

export default function TournamentDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [loading, setLoading] = useState(true)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }

    const [tRes, teamsRes, matchesRes, rolesRes] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('teams').select('*, players(*)').eq('tournament_id', id).order('name'),
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .eq('tournament_id', id).order('match_time', { ascending: true }),
      supabase.from('user_roles').select('role, tournament_id').eq('user_id', user.id),
    ])

    if (!tRes.data) { router.push('/admin'); return }

    const t = tRes.data as Tournament
    const admin = rolesRes.data?.some((r: RoleInfo) => r.role === 'admin') ?? false
    const organizer = admin || (rolesRes.data?.some((r: RoleInfo) => r.role === 'organizer' && r.tournament_id === id) ?? false)

    if (!organizer) { router.push('/admin'); return }

    setTournament(t)
    setTeams((teamsRes.data as TeamWithPlayers[]) ?? [])
    setMatches((matchesRes.data as MatchWithTeams[]) ?? [])
    setIsAdmin(admin)
    setIsOrganizer(organizer)
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  const teamsAlert = teams.some(t => t.players.length < tournament.min_players_per_team) ||
    (tournament.num_groups != null && tournament.teams_per_group != null &&
     teams.length < tournament.num_groups * tournament.teams_per_group)

  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/t/${id}`

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{tournament.name}</span>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-green-600 hover:text-green-500 font-medium">
            Public View →
          </a>
        </div>
      </header>

      <TabStrip active={activeTab} onChange={setActiveTab} teamsAlert={teamsAlert} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            tournament={tournament}
            matches={matches}
            teams={teams}
            tournamentId={id}
            isAdmin={isAdmin}
            isOrganizer={isOrganizer}
            onRefresh={load}
          />
        )}
        {activeTab === 'teams' && (
          <TeamsTab
            teams={teams}
            tournamentStatus={tournament.status}
            tournamentId={id}
            minPlayers={tournament.min_players_per_team}
            onRefresh={load}
          />
        )}
        {activeTab === 'fixtures' && (
          <FixturesTab
            teams={teams}
            matches={matches}
            tournamentStatus={tournament.status}
            tournamentId={id}
            onRefresh={load}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            tournament={tournament}
            matches={matches}
            tournamentId={id}
            isAdmin={isAdmin}
            onRefresh={load}
          />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Lint check**

Run:
```bash
cd web && pnpm lint
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add web/app/admin/tournaments/\[id\]/page.tsx
git commit -m "feat: convert admin tournament page to tabbed client component"
```

---

### Task 10: Verify and clean up

**Files:**
- No new files. Verify the full page works end-to-end.

- [ ] **Step 1: Run full typecheck**

Run:
```bash
cd web && tsc --noEmit
```
Expected: no errors

- [ ] **Step 2: Run lint**

Run:
```bash
cd web && pnpm lint
```
Expected: no errors

- [ ] **Step 3: Manual verification checklist**

Start the dev server (`cd web && pnpm dev`) and navigate to `/admin/tournaments/[id]`:

1. **4 tabs visible** — Overview, Teams (with red dot if teams missing), Fixtures, Settings
2. **Tab switching** — click each tab, verify content renders, verify form state persists (e.g., type in a team name on Teams tab, switch to Fixtures, switch back — input should retain value)
3. **Teams tab red indicator** — add a team with fewer than 11 players, verify red dot on tab + red row highlight
4. **Go Live checklist** — on Overview tab, verify checklist shows what's missing
5. **Go Live** — when all conditions met (teams, roster, date), click Go Live, verify status changes to `active`
6. **Settings save** — change min_players_per_team, save, verify it persists
7. **Lock rules** — after going live, verify teams tab is locked, format is locked in settings
8. **Fixtures** — add a fixture, verify it appears in both Fixtures and Overview matches list

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address verification issues for tabbed admin page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Tabbed interface (4 tabs) — Task 3, 9
- ✅ Content persists across tabs — Task 9 (single client component, React state)
- ✅ Settings tab with dates, min players — Task 8
- ✅ Teams tab red indicator — Task 6
- ✅ Go Live with conditions checklist — Task 4
- ✅ min_players_per_team DB column — Task 1, 2
- ✅ Expected teams from format settings — Task 4 (computeChecks)
- ✅ Scorekeepers in Settings — Task 8

**No placeholders found.** All code blocks are complete.

**Type consistency:** `min_players_per_team` added to `Tournament` interface in Task 2, referenced in Tasks 4, 6, 8, 9 with the same field name.
