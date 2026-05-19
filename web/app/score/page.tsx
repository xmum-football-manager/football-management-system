import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ScoreEntry } from './ScoreEntry'
import { getCurrentUser } from '@/lib/db/tournaments'
import { getScorekeeperAssignments } from '@/lib/db/roles'
import { getScoreableMatches } from '@/lib/db/matches'

export default async function ScorePage() {
  const supabase = await createClient()
  const user = await getCurrentUser(supabase)
  if (!user) redirect('/score/login?redirectTo=/score')

  const roles = await getScorekeeperAssignments(supabase, user.id)
  if (roles.length === 0) return <NoAssignment email={user.email} />

  const matchIds = roles.filter(r => r.match_id).map(r => r.match_id as string)
  const tournamentIds = roles.filter(r => r.tournament_id && !r.match_id).map(r => r.tournament_id as string)

  const matches = await getScoreableMatches(supabase, matchIds, tournamentIds)
  if (matches.length === 0) return <NoAssignment email={user.email} />

  const sorted = [...matches].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1
    if (b.status === 'live' && a.status !== 'live') return 1
    return new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
  })

  return <ScoreEntry matches={sorted} userEmail={user.email ?? ''} />
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
