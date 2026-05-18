'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { toast } from '@/components/Toast'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getMatches } from '@/lib/db/matches'
import { assignScorekeeper, removeScorekeeper } from '@/lib/db/roles'
import type { MatchWithTeams } from '@/lib/supabase/types'

interface ScorekeeperRow {
  user_id: string
  email: string
  match_id: string | null
}

export default function ScorekeepersPage() {
  const { id: tournamentId } = useParams() as { id: string }
  const [scorekeepers, setScorekeepers] = useState<ScorekeeperRow[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [assignEmail, setAssignEmail] = useState('')
  const [assignScope, setAssignScope] = useState<'tournament' | 'match'>('tournament')
  const [assignMatchId, setAssignMatchId] = useState('')
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const supabase = createClient()
    const [skRes, matchesData] = await Promise.all([
      fetch(`/api/admin/scorekeepers?tournamentId=${tournamentId}`),
      getMatches(supabase, tournamentId),
    ])
    if (skRes.ok) setScorekeepers(await skRes.json())
    setMatches(matchesData)
    setLoading(false)
  }, [tournamentId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const matchId = assignScope === 'match' && assignMatchId ? assignMatchId : null
      const result = await assignScorekeeper(assignEmail, tournamentId, matchId)
      if (result.error) { toast.error(result.error.message); return }
      toast.success('Scorekeeper assigned!')
      setAssignEmail('')
      setAssignMatchId('')
      await load()
    })
  }

  function handleRemove(userId: string, matchId: string | null) {
    startTransition(async () => {
      const { error } = await removeScorekeeper(userId, tournamentId, matchId)
      if (error) { toast.error(error.message); return }
      toast.success('Scorekeeper removed.')
      await load()
    })
  }

  if (loading) return <PageShell tournamentId={tournamentId}><div className="text-center py-16 text-slate-400">Loading…</div></PageShell>

  const inp = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <PageShell tournamentId={tournamentId}>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-bold mb-4">Assign Scorekeeper</h2>
          <form onSubmit={handleAssign} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
              <input type="email" value={assignEmail} onChange={e => setAssignEmail(e.target.value)} required placeholder="scorekeeper@example.com" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Scope</label>
              <div className="flex gap-3">
                {(['tournament', 'match'] as const).map(s => (
                  <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="scope" value={s} checked={assignScope === s} onChange={() => setAssignScope(s)} className="accent-green-600" />
                    {s === 'tournament' ? 'Entire tournament' : 'Specific match'}
                  </label>
                ))}
              </div>
            </div>
            {assignScope === 'match' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Match</label>
                <select value={assignMatchId} onChange={e => setAssignMatchId(e.target.value)} required className={inp}>
                  <option value="">Select match…</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>{m.home_team.name} vs {m.away_team.name} — {new Date(m.match_time).toLocaleDateString('en-MY')}</option>
                  ))}
                </select>
              </div>
            )}
            <button type="submit" disabled={isPending} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm">
              {isPending ? 'Assigning…' : 'Assign Scorekeeper'}
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-base font-bold mb-3">Assigned ({scorekeepers.length})</h2>
          {scorekeepers.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No scorekeepers assigned yet.</div>
          ) : (
            <div className="space-y-2">
              {scorekeepers.map(sk => {
                const match = matches.find(m => m.id === sk.match_id)
                return (
                  <div key={`${sk.user_id}-${sk.match_id}`} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-700">{sk.email}</p>
                      <p className="text-xs text-slate-400">
                        {sk.match_id && match ? `${match.home_team.name} vs ${match.away_team.name}` : 'Entire tournament'}
                      </p>
                    </div>
                    <button onClick={() => handleRemove(sk.user_id, sk.match_id)} disabled={isPending} className="text-red-400 hover:text-red-600 text-sm font-medium">Remove</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function PageShell({ tournamentId, children }: { tournamentId: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-4">
          <Link href={`/admin/tournaments/${tournamentId}`} className="text-slate-500 hover:text-slate-700 text-sm">← Tournament</Link>
          <span className="font-bold text-slate-900">Scorekeepers</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
