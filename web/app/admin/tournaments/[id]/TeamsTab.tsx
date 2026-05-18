'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import { canManageTeams } from '@/lib/lock-rules'
import { CsvImport } from './CsvImport'
import type { TeamWithPlayers, Player, TournamentStatus } from '@/lib/supabase/types'

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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editTeamName, setEditTeamName] = useState('')
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

  function deleteTeam(teamId: string) {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('teams').delete().eq('id', teamId)
      setConfirmDelete(null)
      if (error) { toast.error(error.message); return }
      if (selectedTeam === teamId) setSelectedTeam(null)
      toast.success('Team deleted.')
      onRefresh()
    })
  }

  function startRename(teamId: string, currentName: string) {
    setEditingTeam(teamId)
    setEditTeamName(currentName)
  }

  function saveRename() {
    if (!editingTeam || !editTeamName.trim()) { setEditingTeam(null); return }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('teams').update({ name: editTeamName.trim() }).eq('id', editingTeam)
      setEditingTeam(null)
      if (error) { toast.error(error.message); return }
      toast.success('Team renamed.')
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
        <CsvImport tournamentId={tournamentId} existingTeams={teams} disabled={teamsLocked} onRefresh={onRefresh} />
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
              const isConfirmingDelete = confirmDelete === t.id
              const isEditing = editingTeam === t.id
              return (
                <div key={t.id}
                  className={`w-full text-left bg-white rounded-xl border px-4 py-3 transition-colors ${
                    selectedTeam === t.id ? 'border-green-500 ring-1 ring-green-500' :
                    isUnder ? 'border-red-300 bg-red-50' :
                    'border-slate-200'
                  }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          type="text" value={editTeamName}
                          onChange={e => setEditTeamName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditingTeam(null) }}
                          onBlur={saveRename}
                          autoFocus
                          className="w-full border border-green-400 rounded px-2 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      ) : (
                        <button onClick={() => setSelectedTeam(selectedTeam === t.id ? null : t.id)} className="text-left w-full">
                          <p className="font-medium text-slate-900 flex items-center gap-2">
                            {t.name}
                            {isUnder && <span className="text-red-500 text-xs font-semibold">⚠ {t.players.length}/{minPlayers}</span>}
                          </p>
                          <p className={`text-xs ${isUnder ? 'text-red-400' : 'text-slate-400'}`}>
                            {isUnder ? `Need ${minPlayers - t.players.length} more player${minPlayers - t.players.length !== 1 ? 's' : ''}` : `${t.players.length} players`}
                          </p>
                        </button>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        {!teamsLocked && (
                          <>
                            <button onClick={() => startRename(t.id, t.name)}
                              title="Rename team"
                              className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 text-sm leading-none">
                              ✏️
                            </button>
                            {isConfirmingDelete ? (
                              <>
                                <button onClick={() => deleteTeam(t.id)} disabled={isPending}
                                  className="text-xs text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 px-2 py-0.5 rounded font-semibold">
                                  Delete
                                </button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="text-xs text-slate-500 hover:text-slate-700 px-1 py-0.5">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setConfirmDelete(t.id)}
                                title="Delete team"
                                className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 text-sm leading-none">
                                🗑️
                              </button>
                            )}
                          </>
                        )}
                        <span className="text-slate-300 text-sm ml-1">{selectedTeam === t.id ? '▲' : '▼'}</span>
                      </div>
                    )}
                  </div>
                </div>
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
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', jersey_number: '', position: '' })
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState<string | null>(null)
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
      setConfirmDeletePlayer(null)
      onUpdate()
    })
  }

  function startEditPlayer(p: Player) {
    setEditingPlayer(p.id)
    setEditForm({
      name: p.name,
      jersey_number: p.jersey_number?.toString() ?? '',
      position: p.position ?? '',
    })
  }

  function saveEditPlayer() {
    if (!editingPlayer || !editForm.name.trim()) { setEditingPlayer(null); return }
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.from('players').update({
        name: editForm.name.trim(),
        jersey_number: editForm.jersey_number ? parseInt(editForm.jersey_number) : null,
        position: editForm.position.trim() || null,
      }).eq('id', editingPlayer)
      setEditingPlayer(null)
      if (error) { toast.error(error.message); return }
      toast.success('Player updated.')
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
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const isEditing = editingPlayer === p.id
                const isConfirming = confirmDeletePlayer === p.id
                if (isEditing) {
                  return (
                    <tr key={p.id} className="border-b border-slate-50 bg-green-50">
                      <td className="px-2 py-1.5">
                        <input type="number" value={editForm.jersey_number}
                          onChange={e => setEditForm(f => ({ ...f, jersey_number: e.target.value }))}
                          min="1" max="99"
                          className="w-12 border border-slate-300 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={editForm.name}
                          onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditPlayer(); if (e.key === 'Escape') setEditingPlayer(null) }}
                          autoFocus
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="text" value={editForm.position}
                          onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <button onClick={saveEditPlayer} disabled={isPending || !editForm.name.trim()}
                            className="text-xs text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 px-2 py-0.5 rounded font-semibold">
                            Save
                          </button>
                          <button onClick={() => setEditingPlayer(null)}
                            className="text-xs text-slate-500 hover:text-slate-700 px-1 py-0.5">
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 tabular-nums text-slate-400">{p.jersey_number ?? '—'}</td>
                    <td className="px-4 py-2 font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-slate-500">{p.position ?? '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-0.5">
                        {!locked && !isConfirming && (
                          <button onClick={() => startEditPlayer(p)} disabled={isPending}
                            title="Edit player"
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 text-sm leading-none">
                            ✏️
                          </button>
                        )}
                        {isConfirming ? (
                          <>
                            <button onClick={() => removePlayer(p.id)} disabled={isPending}
                              className="text-xs text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 px-1.5 py-0.5 rounded font-semibold">
                              Del
                            </button>
                            <button onClick={() => setConfirmDeletePlayer(null)}
                              className="text-xs text-slate-500 hover:text-slate-700 px-0.5">
                              ✕
                            </button>
                          </>
                        ) : !locked && (
                          <button onClick={() => setConfirmDeletePlayer(p.id)}
                            title="Delete player"
                            className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50 text-sm leading-none">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
