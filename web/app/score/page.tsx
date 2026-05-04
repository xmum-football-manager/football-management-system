import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScoreEntry } from './ScoreEntry'
import type { MatchWithTeams } from '@/lib/supabase/types'

export default async function ScorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/score/login')

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role, tournament_id, match_id')
    .eq('user_id', user.id)
    .eq('role', 'scorekeeper')

  if (!roles || roles.length === 0) return <NoAssignment email={user.email} />

  const matchIds = roles.filter(r => r.match_id).map(r => r.match_id as string)
  const tournamentIds = roles.filter(r => r.tournament_id && !r.match_id).map(r => r.tournament_id as string)

  const filters: string[] = []
  if (matchIds.length > 0) filters.push(`id.in.(${matchIds.join(',')})`)
  if (tournamentIds.length > 0) filters.push(`tournament_id.in.(${tournamentIds.join(',')})`)
  if (filters.length === 0) return <NoAssignment email={user.email} />

  const { data: matches } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
    .in('status', ['scheduled', 'live', 'halftime'])
    .or(filters.join(','))
    .order('match_time', { ascending: true })

  if (!matches || matches.length === 0) return <NoAssignment email={user.email} />

  const sorted = [...matches].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1
    if (b.status === 'live' && a.status !== 'live') return 1
    return new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
  })

  return <ScoreEntry matches={sorted as MatchWithTeams[]} userEmail={user.email ?? ''} />
}

function NoAssignment({ email }: { email?: string }) {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-5xl mb-4">⚽</p>
        <h1 className="text-white text-xl font-bold mb-2">No match assigned</h1>
        <p className="text-slate-400 text-sm">Contact the organizer to be assigned to a match.</p>
        {email && <p className="text-slate-500 text-xs mt-4">{email}</p>}
      </div>
    </div>
  )
}
