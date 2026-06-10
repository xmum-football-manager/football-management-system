import { redirect } from 'next/navigation'
import { requireScorekeeperUser } from '@/lib/auth'
import { listScorekeeperMatchesForUser } from '@/lib/db/roles'
import { createClient } from '@/lib/supabase/server'
import { withTeamFallback } from '@/lib/match-teams'
import type { MatchWithTeams } from '@/lib/supabase/types'
import { ScoreApp } from './ScoreApp'

export default async function ScorePage() {
  const user = await requireScorekeeperUser()

  if (user.user_metadata?.must_change_password) {
    redirect('/change-password?redirectTo=/score')
  }

  const matchIds = await listScorekeeperMatchesForUser(user.id)
  let matches: MatchWithTeams[] = []
  if (matchIds.length > 0) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .in('id', matchIds)
      .neq('status', 'finished')
      .order('match_time', { ascending: true })
    matches = withTeamFallback((data ?? []) as unknown as MatchWithTeams[])
  }

  return <ScoreApp email={user.email ?? ''} initialMatches={matches} />
}
