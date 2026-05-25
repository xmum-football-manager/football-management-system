# Setup Context Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the loading flicker between `/admin/tournaments/[id]/setup/*` tabs by hoisting data fetching from each page into a shared layout-level React Context provider.

**Architecture:** The `setup/layout.tsx` already persists across child route changes (Next.js App Router behavior). We move all fetching (tournament, teams, matches, roles) into the layout, expose it via a typed React Context (`SetupContext`), and convert each child page into a pure consumer that reads from the hook. Mutations call `refresh()` on the context to refetch from the layout. Result: data is fetched once per tournament visit, not once per tab click.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase client (existing DAL in `lib/db/`).

---

## File Structure

**Create:**
- `web/app/admin/tournaments/[id]/setup/SetupContext.tsx` — Context + `useSetup()` hook + `SetupProvider` component

**Modify:**
- `web/app/admin/tournaments/[id]/setup/layout.tsx` — Fetch tournament, teams, matches, roles; wrap children in `SetupProvider`; show full-page skeleton during initial load
- `web/app/admin/tournaments/[id]/setup/teams/page.tsx` — Strip self-fetching; consume `useSetup()`
- `web/app/admin/tournaments/[id]/setup/fixtures/page.tsx` — Strip self-fetching; consume `useSetup()`
- `web/app/admin/tournaments/[id]/setup/settings/page.tsx` — Strip self-fetching; consume `useSetup()`

**No changes:**
- Main `[id]/page.tsx` (Overview) — keeps its own fetching; not part of `/setup` layout
- `SettingsTab.tsx` component — receives data as props; unchanged
- DAL functions in `lib/db/` — unchanged

---

## Task 1: Create SetupContext with provider and hook

**Files:**
- Create: `web/app/admin/tournaments/[id]/setup/SetupContext.tsx`

- [ ] **Step 1: Write the context file**

```tsx
'use client'

import { createContext, useContext } from 'react'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

export interface SetupContextValue {
  tournament: Tournament
  teams: TeamWithPlayers[]
  matches: MatchWithTeams[]
  isAdmin: boolean
  isOrganizer: boolean
  refresh: () => Promise<void>
}

const SetupContext = createContext<SetupContextValue | null>(null)

export function SetupProvider({ value, children }: { value: SetupContextValue; children: React.ReactNode }) {
  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>
}

export function useSetup(): SetupContextValue {
  const ctx = useContext(SetupContext)
  if (!ctx) throw new Error('useSetup must be called inside <SetupProvider>')
  return ctx
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && pnpm tsc --noEmit`
Expected: no errors (file is unused so far)

- [ ] **Step 3: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager
git add web/app/admin/tournaments/\[id\]/setup/SetupContext.tsx
git commit -m "feat(setup): add SetupContext for shared tournament data"
```

---

## Task 2: Wire layout to fetch data and provide context

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/layout.tsx`

- [ ] **Step 1: Rewrite the layout to fetch all data and provide context**

Replace the entire contents of `web/app/admin/tournaments/[id]/setup/layout.tsx` with:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getTournament, getCurrentUser, getUserRoles } from '@/lib/db/tournaments'
import { getTeams } from '@/lib/db/teams'
import { getMatches } from '@/lib/db/matches'
import { TabStrip } from '../TabStrip'
import { SetupProvider, type SetupContextValue } from './SetupContext'
import type { Tournament, MatchWithTeams, TeamWithPlayers } from '@/lib/supabase/types'

interface RoleInfo { role: string; tournament_id: string | null }

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const load = useCallback(async () => {
    const supabase = createClient()
    const user = await getCurrentUser(supabase)
    if (!user) { window.location.href = '/login'; return }

    const [t, teamsData, matchesData, roles] = await Promise.all([
      getTournament(supabase, id),
      getTeams(supabase, id),
      getMatches(supabase, id),
      getUserRoles(supabase, user.id),
    ])

    if (!t) { router.push('/admin'); return }

    const admin = roles.some((r: RoleInfo) => r.role === 'admin')
    const organizer = admin || roles.some((r: RoleInfo) => r.role === 'organizer' && r.tournament_id === id)

    if (!organizer) { router.push('/admin'); return }

    setTournament(t)
    setTeams(teamsData)
    setMatches(matchesData)
    setIsAdmin(admin)
    setIsOrganizer(organizer)
    setLoading(false)
  }, [id, router])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  if (loading || !tournament) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  const value: SetupContextValue = { tournament, teams, matches, isAdmin, isOrganizer, refresh: load }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{tournament.name}</span>
          <div className="w-20" />
        </div>
      </header>
      <TabStrip />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <SetupProvider value={value}>{children}</SetupProvider>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify layout still renders in browser**

Run browse against http://localhost:3000/admin/tournaments/8223d853-0e25-42b2-81a0-c720a13220df/setup/teams and confirm the page loads. Teams page is still self-fetching at this point; it should work because the context is provided but unused.

- [ ] **Step 4: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager
git add web/app/admin/tournaments/\[id\]/setup/layout.tsx
git commit -m "feat(setup): fetch tournament data in layout and provide via context"
```

---

## Task 3: Convert teams page to consume context

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/teams/page.tsx`

- [ ] **Step 1: Replace teams page with context consumer**

Replace the entire contents of `web/app/admin/tournaments/[id]/setup/teams/page.tsx` with:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/components/Toast'
import { canManageTeams } from '@/lib/lock-rules'
import { createClient } from '@/lib/supabase/client'
import { createTeam, deleteTeam } from '@/lib/db/teams'
import { createPlayer, deletePlayer } from '@/lib/db/players'
import { useSetup } from '../SetupContext'
import type { TeamWithPlayers } from '@/lib/supabase/types'

export default function SetupTeamsPage() {
  const { tournament, teams, refresh } = useSetup()
  const tournamentId = tournament.id
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const supabase = createClient()

  function addTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    startTransition(async () => {
      try {
        await createTeam(supabase, tournamentId, newTeamName.trim())
        setNewTeamName('')
        toast.success(`Team "${newTeamName.trim()}" added!`)
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add team.')
      }
    })
  }

  function handleDeleteTeam(teamId: string) {
    startTransition(async () => {
      try {
        await deleteTeam(supabase, teamId)
        if (selectedTeam === teamId) setSelectedTeam(null)
        toast.success('Team deleted.')
        await refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete team.')
      }
    })
  }

  const activeTeam = teams.find(t => t.id === selectedTeam)
  const teamsLocked = !canManageTeams(tournament.status)

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
            {teams.map(t => (
              <button key={t.id} onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)}
                className={`w-full text-left bg-white rounded-xl border px-4 py-3 flex items-center justify-between transition-colors ${selectedTeam === t.id ? 'border-green-500 ring-1 ring-green-500' : 'border-slate-200 hover:border-slate-300'}`}>
                <div>
                  <p className="font-medium text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.players.length} players</p>
                </div>
                <div className="flex items-center gap-1">
                  {!teamsLocked && (
                    <button onClick={e => { e.stopPropagation(); handleDeleteTeam(t.id) }}
                      className="text-red-400 hover:text-red-600 text-xs px-1 py-0.5">🗑️</button>
                  )}
                  <span className="text-slate-400 text-sm">{selectedTeam === t.id ? '▲' : '▼'}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        {activeTeam ? (
          <RosterEditor supabase={supabase} team={activeTeam} onUpdate={refresh} locked={teamsLocked} />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            <p>Select a team to edit its roster.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RosterEditor({ supabase, team, onUpdate, locked }: { supabase: ReturnType<typeof createClient>; team: TeamWithPlayers; onUpdate: () => Promise<void>; locked: boolean }) {
  const [form, setForm] = useState({ name: '', jersey_number: '', position: '' })
  const [isPending, startTransition] = useTransition()
  const sorted = [...team.players].sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999))

  function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    startTransition(async () => {
      try {
        await createPlayer(supabase, {
          team_id: team.id, name: form.name.trim(),
          jersey_number: form.jersey_number ? parseInt(form.jersey_number) : null,
          position: form.position.trim() || null,
        })
        setForm({ name: '', jersey_number: '', position: '' })
        toast.success('Player added!')
        await onUpdate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add player.')
      }
    })
  }

  function handleDeletePlayer(playerId: string) {
    startTransition(async () => {
      try {
        await deletePlayer(supabase, playerId)
        await onUpdate()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete player.')
      }
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
                    <button onClick={() => handleDeletePlayer(p.id)} disabled={isPending || locked} className="text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none">×</button>
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

- [ ] **Step 2: Run typecheck**

Run: `cd web && pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify teams page in browser**

Navigate to http://localhost:3000/admin/tournaments/8223d853-0e25-42b2-81a0-c720a13220df/setup/teams. Confirm:
- Teams list shows existing teams (__pw-team-alpha, __pw-team-beta)
- No "Loading…" appears on the teams page itself (only layout-level loading on first visit)
- Adding a team triggers refresh and shows the new team

- [ ] **Step 4: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager
git add web/app/admin/tournaments/\[id\]/setup/teams/page.tsx
git commit -m "refactor(setup): consume context in teams page"
```

---

## Task 4: Convert fixtures page to consume context

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/fixtures/page.tsx`

- [ ] **Step 1: Replace fixtures page with context consumer**

Replace the entire contents of `web/app/admin/tournaments/[id]/setup/fixtures/page.tsx` with:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/components/Toast'
import { canAddFixture, canDeleteFixture, canEditMatchTime } from '@/lib/lock-rules'
import { createClient } from '@/lib/supabase/client'
import { createMatch, deleteMatch, updateMatchTime } from '@/lib/db/matches'
import { useSetup } from '../SetupContext'
import type { MatchWithTeams } from '@/lib/supabase/types'

function statusPill(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    scheduled: { label: 'Scheduled', classes: 'bg-slate-100 text-slate-600' },
    live: { label: 'Live', classes: 'bg-green-100 text-green-700' },
    halftime: { label: 'Halftime', classes: 'bg-amber-100 text-amber-700' },
    finished: { label: 'Finished', classes: 'bg-blue-50 text-blue-600' },
  }
  const s = map[status] ?? { label: status, classes: 'bg-slate-100 text-slate-500' }
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${s.classes}`}>
      {s.label}
    </span>
  )
}

export default function SetupFixturesPage() {
  const { tournament, teams, matches, refresh } = useSetup()
  const tournamentId = tournament.id
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', match_date: '', match_time: '' })
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState('')
  const [editingTime, setEditingTime] = useState('')
  const supabase = createClient()

  function validateForm(): string[] {
    const errors: string[] = []
    if (form.home_team_id === form.away_team_id) errors.push('A team cannot play against itself.')
    if (form.home_team_id && form.away_team_id && form.match_date && form.match_time) {
      const newTime = new Date(`${form.match_date}T${form.match_time}`).getTime()
      const clash = matches.some(m => {
        if (m.status !== 'scheduled') return false
        const existing = new Date(m.match_time).getTime()
        const diff = Math.abs(newTime - existing)
        return diff < 3600000 && (m.home_team_id === form.home_team_id || m.away_team_id === form.home_team_id || m.home_team_id === form.away_team_id || m.away_team_id === form.away_team_id)
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
        await createMatch(supabase, tournamentId, form.home_team_id, form.away_team_id, new Date(`${form.match_date}T${form.match_time}`).toISOString())
        setForm({ home_team_id: '', away_team_id: '', match_date: '', match_time: '' })
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
    if (!canEditMatchTime(tournament.status, match.status)) return
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

  const sel = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
  const selError = 'w-full border border-red-400 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50'
  const fixturesLocked = !canAddFixture(tournament.status)

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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Match Date & Time</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.match_date} onChange={e => { setForm(f => ({ ...f, match_date: e.target.value })); setFormErrors([]) }} required className={formErrors.length > 0 ? selError : sel} />
                <input type="time" value={form.match_time} onChange={e => { setForm(f => ({ ...f, match_time: e.target.value })); setFormErrors([]) }} required className={formErrors.length > 0 ? selError : sel} />
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

      <div>
        <h2 className="text-base font-bold mb-3">All Matches ({matches.length})</h2>
        {matches.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No fixtures yet.</div>
        ) : (
          <div className="space-y-2">
            {matches.map(m => {
              const canDelete = canDeleteFixture(tournament.status)
              const canEdit = canEditMatchTime(tournament.status, m.status)
              const isEditing = editingMatchId === m.id
              return (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
                    <p className="font-medium text-sm whitespace-nowrap">{m.home_team.name} vs {m.away_team.name}</p>
                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input type="date" value={editingDate} onChange={e => setEditingDate(e.target.value)}
                          className="border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" autoFocus />
                        <input type="time" value={editingTime} onChange={e => setEditingTime(e.target.value)}
                          className="border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
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
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify fixtures page in browser**

Navigate to http://localhost:3000/admin/tournaments/8223d853-0e25-42b2-81a0-c720a13220df/setup/fixtures. Confirm:
- Existing fixture (__pw-team-alpha vs __pw-team-beta) is listed
- No page-level "Loading…"
- Switching from /setup/teams → /setup/fixtures shows instantly (no flicker)

- [ ] **Step 4: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager
git add web/app/admin/tournaments/\[id\]/setup/fixtures/page.tsx
git commit -m "refactor(setup): consume context in fixtures page"
```

---

## Task 5: Convert settings page to consume context

**Files:**
- Modify: `web/app/admin/tournaments/[id]/setup/settings/page.tsx`

- [ ] **Step 1: Replace settings page with context consumer**

Replace the entire contents of `web/app/admin/tournaments/[id]/setup/settings/page.tsx` with:

```tsx
'use client'

import { SettingsTab } from '../../SettingsTab'
import { useSetup } from '../SetupContext'

export default function SetupSettingsPage() {
  const { tournament, matches, isAdmin, refresh } = useSetup()
  return (
    <SettingsTab
      tournament={tournament}
      matches={matches}
      tournamentId={tournament.id}
      isAdmin={isAdmin}
      onRefresh={refresh}
    />
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd web && pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Verify settings page in browser**

Navigate to http://localhost:3000/admin/tournaments/8223d853-0e25-42b2-81a0-c720a13220df/setup/settings. Confirm:
- Settings form populated with current tournament values
- No page-level "Loading…"
- Switching from /setup/teams → /setup/settings shows instantly

- [ ] **Step 4: Commit**

```bash
cd /home/alex-lee/Desktop/football-manager
git add web/app/admin/tournaments/\[id\]/setup/settings/page.tsx
git commit -m "refactor(setup): consume context in settings page"
```

---

## Task 6: Final end-to-end verification

**Files:** (none — verification only)

- [ ] **Step 1: Run full typecheck**

Run: `cd web && pnpm tsc --noEmit`
Expected: no errors

- [ ] **Step 2: Run lint**

Run: `cd web && pnpm lint`
Expected: no errors (warnings OK)

- [ ] **Step 3: Run tests**

Run: `cd web && pnpm test`
Expected: all pass (no test changes were made; ensure nothing regressed)

- [ ] **Step 4: Visual verification — tab switching is smooth**

Using the browse skill:
1. Navigate to http://localhost:3000/admin/tournaments/8223d853-0e25-42b2-81a0-c720a13220df/setup/teams
2. Click Fixtures tab — should NOT show "Loading…"
3. Click Settings tab — should NOT show "Loading…"
4. Click Teams tab — should NOT show "Loading…"
5. Hard-refresh on /setup/fixtures — layout-level "Loading…" briefly OK, then renders

Capture a screenshot of /setup/fixtures after a fresh load and one after switching from /setup/teams. Confirm no flicker on the second.

- [ ] **Step 5: Verify mutations still trigger a refresh**

1. On /setup/teams, add a new team named "test-team"
2. Confirm it appears in the list
3. Delete the team
4. Confirm it disappears from the list

- [ ] **Step 6: Commit any final cleanup (if needed)**

If verification revealed any issues that required fixes, commit them. Otherwise skip.

```bash
cd /home/alex-lee/Desktop/football-manager
git status   # should be clean
```

---

## Done Criteria

- All 6 tasks complete with green checkboxes
- `pnpm tsc --noEmit` passes
- `pnpm lint` passes
- `pnpm test` passes
- Visual verification: zero page-level loading flicker when switching between /setup/teams, /setup/fixtures, /setup/settings within a session
- Mutations (add/delete team, schedule fixture, save settings) still cause UI to reflect the change via `refresh()`
