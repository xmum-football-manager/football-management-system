import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MatchStatusControls } from './MatchStatusControls'
import { OrganizerAssignment } from './OrganizerAssignment'
import { ScoreEditor } from './ScoreEditor'
import type { Tournament, MatchWithTeams } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', id).single()
  if (!tournament) notFound()

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .eq('tournament_id', id)
    .order('match_time', { ascending: true })

  const { data: roles } = await supabase
    .from('user_roles').select('role, tournament_id').eq('user_id', user.id)

  const isAdmin = roles?.some(r => r.role === 'admin') ?? false
  const isOrganizer = isAdmin || roles?.some(r => r.role === 'organizer' && r.tournament_id === id)
  if (!isOrganizer) redirect('/admin')

  const t = tournament as Tournament
  const allMatches = (matches ?? []) as MatchWithTeams[]
  const liveCount = allMatches.filter(m => m.status === 'live').length
  const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL}/t/${id}`

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700 text-sm">← Dashboard</Link>
          <span className="font-bold text-slate-900 truncate max-w-xs">{t.name}</span>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-green-600 hover:text-green-500 font-medium">
            Public View →
          </a>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Status" value={<span className="capitalize">{t.status}</span>} />
          <StatCard label="Matches" value={allMatches.length} />
          <StatCard label="Live Now" value={liveCount} highlight={liveCount > 0} />
          <StatCard label="Format" value={t.format === 'round_robin' ? 'Round Robin' : 'Knockout'} />
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { href: `/admin/tournaments/${id}/teams`, label: 'Teams & Rosters' },
            { href: `/admin/tournaments/${id}/fixtures`, label: 'Fixtures' },
            { href: `/admin/tournaments/${id}/scorekeepers`, label: 'Scorekeepers' },
            { href: `/admin/tournaments/${id}/edit`, label: 'Edit Tournament' },
          ].map(({ href, label }) => (
            <Link key={href} href={href}
              className="bg-white border border-slate-200 hover:border-green-500 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {label}
            </Link>
          ))}
        </div>

        {isAdmin && <OrganizerAssignment tournamentId={id} />}

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Matches</h2>
          {allMatches.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500">No fixtures yet.</p>
              <Link href={`/admin/tournaments/${id}/fixtures`}
                className="mt-3 inline-block text-sm text-green-600 hover:text-green-500 font-medium">
                Add fixtures →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {allMatches.map(m => (
                <MatchRow key={m.id} match={m} tournamentId={id} isOrganizer={!!isOrganizer} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </section>
      </main>
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
