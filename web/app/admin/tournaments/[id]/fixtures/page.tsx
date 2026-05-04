'use client'

import { useState, useTransition, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/components/Toast'
import Link from 'next/link'
import type { Team, MatchWithTeams } from '@/lib/supabase/types'

export default function FixturesPage() {
  const { id: tournamentId } = useParams() as { id: string }
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<MatchWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', match_time: '' })
  const [isPending, startTransition] = useTransition()

  async function load() {
    const supabase = createClient()
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('teams').select('*').eq('tournament_id', tournamentId).order('name'),
      supabase.from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .eq('tournament_id', tournamentId).order('match_time', { ascending: true }),
    ])
    setTeams(t ?? [])
    setMatches((m ?? []) as MatchWithTeams[])
    setLoading(false)
  }

  useEffect(() => { load() }, [tournamentId])

  function addFixture(e: React.FormEvent) {
    e.preventDefault()
    if (form.home_team_id === form.away_team_id) { toast.error('Teams must be different.'); return }
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
      toast.success('Fixture added!')
      await load()
    })
  }

  function deleteFixture(matchId: string, status: string) {
    if (status !== 'scheduled') { toast.error('Can only delete scheduled matches.'); return }
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('matches').delete().eq('id', matchId)
      toast.success('Fixture removed.')
      await load()
    })
  }

  if (loading) return <PageShell tournamentId={tournamentId}><div className="text-center py-16 text-slate-400">Loading…</div></PageShell>

  const sel = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

  return (
    <PageShell tournamentId={tournamentId}>
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-base font-bold mb-4">Add Fixture</h2>
          {teams.length < 2 ? (
            <p className="text-slate-500 text-sm">
              Add at least 2 teams first.{' '}
              <Link href={`/admin/tournaments/${tournamentId}/teams`} className="text-green-600 font-medium">Manage teams →</Link>
            </p>
          ) : (
            <form onSubmit={addFixture} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Home Team</label>
                <select value={form.home_team_id} onChange={e => setForm(f => ({ ...f, home_team_id: e.target.value }))} required className={sel}>
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Away Team</label>
                <select value={form.away_team_id} onChange={e => setForm(f => ({ ...f, away_team_id: e.target.value }))} required className={sel}>
                  <option value="">Select…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date & Time</label>
                <input type="datetime-local" value={form.match_time} onChange={e => setForm(f => ({ ...f, match_time: e.target.value }))} required className={sel} />
              </div>
              <button type="submit" disabled={isPending} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg text-sm">Add</button>
            </form>
          )}
        </div>

        <div>
          <h2 className="text-base font-bold mb-3">Fixtures ({matches.length})</h2>
          {matches.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">No fixtures yet.</div>
          ) : (
            <div className="space-y-2">
              {matches.map(m => (
                <div key={m.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{m.home_team.name} vs {m.away_team.name}</p>
                    <p className="text-xs text-slate-400">{new Date(m.match_time).toLocaleString('en-MY', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${m.status === 'live' ? 'bg-green-100 text-green-700' : m.status === 'finished' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{m.status}</span>
                    {m.status === 'scheduled' && (
                      <button onClick={() => deleteFixture(m.id, m.status)} disabled={isPending} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}
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
          <span className="font-bold text-slate-900">Fixtures</span>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
