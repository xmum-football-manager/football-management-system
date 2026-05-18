'use client'

import { useState, useTransition } from 'react'
import { toast } from '@/components/Toast'
import { canAddFixture, canDeleteFixture, canEditMatchTime } from '@/lib/lock-rules'
import { createMatch, deleteMatch, updateMatchTime } from '@/lib/db/matches'
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
      const { error } = await createMatch(
        tournamentId,
        form.home_team_id,
        form.away_team_id,
        new Date(form.match_time).toISOString()
      )
      if (error) { toast.error(error.message); return }
      setForm({ home_team_id: '', away_team_id: '', match_time: '' })
      setFormErrors([])
      toast.success('Fixture scheduled!')
      onRefresh()
    })
  }

  function handleDeleteFixture(matchId: string) {
    startTransition(async () => {
      await deleteMatch(matchId)
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
      const { error } = await updateMatchTime(editingMatchId, new Date(editingTime).toISOString())
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
                      <button onClick={() => handleDeleteFixture(m.id)} disabled={isPending || !canDelete} className="text-red-400 hover:text-red-600 disabled:opacity-30 text-lg leading-none">×</button>
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
