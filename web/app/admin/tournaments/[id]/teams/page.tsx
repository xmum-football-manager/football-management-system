'use client'

import { useState, useTransition, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/components/Toast'
import Link from 'next/link'
import { canManageTeams } from '@/lib/lock-rules'
import { getTeams, getTournamentStatus, createTeam, deleteTeam, renameTeam } from '@/lib/db/teams'
import { createPlayer, deletePlayer, updatePlayer } from '@/lib/db/players'
import type { TeamWithPlayers, Player, TournamentStatus } from '@/lib/supabase/types'

export default function TeamsPage() {
  const { id: tournamentId } = useParams() as { id: string }
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTeamName, setNewTeamName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function loadTeams() {
    const [status, teamsData] = await Promise.all([
      getTournamentStatus(tournamentId),
      getTeams(tournamentId),
    ])
    setTournamentStatus(status)
    setTeams(teamsData)
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTeams() }, [tournamentId])

  function addTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!newTeamName.trim()) return
    startTransition(async () => {
      const { error } = await createTeam(tournamentId, newTeamName.trim())
      if (error) { toast.error(error.message); return }
      setNewTeamName('')
      toast.success(`Team "${newTeamName.trim()}" added!`)
      await loadTeams()
    })
  }

  function handleDeleteTeam(teamId: string) {
    startTransition(async () => {
      const { error } = await deleteTeam(teamId)
      if (error) { toast.error(error.message); return }
      if (selectedTeam === teamId) setSelectedTeam(null)
      toast.success('Team deleted.')
      await loadTeams()
    })
  }

  function handleRenameTeam(teamId: string, name: string) {
    startTransition(async () => {
      const { error } = await renameTeam(teamId, name)
      if (error) { toast.error(error.message); return }
      toast.success('Team renamed.')
      await loadTeams()
    })
  }

  if (loading) return <PageShell tournamentId={tournamentId}><div className="text-center py-16 text-slate-400">Loading…</div></PageShell>

  const activeTeam = teams.find(t => t.id === selectedTeam)
  const teamsLocked = tournamentStatus !== null && !canManageTeams(tournamentStatus)

  return (
    <PageShell tournamentId={tournamentId}>
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
                      <>
                        <button onClick={e => { e.stopPropagation(); handleDeleteTeam(t.id) }}
                          className="text-red-400 hover:text-red-600 text-xs px-1 py-0.5">🗑️</button>
                      </>
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
            <RosterEditor team={activeTeam} onUpdate={loadTeams} locked={teamsLocked} />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
              <p>Select a team to edit its roster.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
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
      const { error } = await createPlayer({
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

  function handleDeletePlayer(playerId: string) {
    startTransition(async () => {
      await deletePlayer(playerId)
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

function PageShell({ tournamentId, children }: { tournamentId: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href={`/admin/tournaments/${tournamentId}`} className="text-slate-500 hover:text-slate-700 text-sm">← Tournament</Link>
          <span className="font-bold text-slate-900">Teams & Rosters</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
