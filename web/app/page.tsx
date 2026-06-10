import { createClient } from '@/lib/supabase/server'
import type { Tournament, Team, MatchWithTeams, Standing } from '@/lib/supabase/types'
import { withTeamFallback } from '@/lib/match-teams'
import { HomeView } from './HomeView'
import './home.css'

export const revalidate = 60

export default async function HomePage() {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true') {
    const { MOCK_TOURNAMENTS } = await import('@/lib/dev-fixtures')
    return (
      <HomeView
        tournaments={MOCK_TOURNAMENTS.filter((t) => t.status !== 'setup')}
        initialMatches={[]}
        teams={[]}
        standings={[]}
        liveSync={false}
      />
    )
  }

  const supabase = await createClient()
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .in('status', ['active', 'finished'])
    .order('start_date', { ascending: false })

  const list = (tournaments ?? []) as Tournament[]
  const ids = list.map((t) => t.id)

  let matches: MatchWithTeams[] = []
  let teams: Team[] = []
  let standings: Standing[] = []

  if (ids.length > 0) {
    // Standings only needed to derive round-robin champions
    const finishedRRIds = list
      .filter((t) => t.status === 'finished' && t.format === 'round_robin')
      .map((t) => t.id)

    const [matchesRes, teamsRes, standingsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
        .in('tournament_id', ids)
        .order('match_time', { ascending: true }),
      supabase.from('teams').select('*').in('tournament_id', ids),
      finishedRRIds.length > 0
        ? supabase.from('standings').select('*').in('tournament_id', finishedRRIds)
        : Promise.resolve({ data: [] }),
    ])

    // Only scheduled (non-null match_time) or started matches are public
    matches = withTeamFallback((matchesRes.data ?? []) as MatchWithTeams[]).filter(
      (m) => m.match_time !== null || m.status !== 'scheduled',
    )
    teams = (teamsRes.data ?? []) as Team[]
    standings = (standingsRes.data ?? []) as Standing[]
  }

  return (
    <HomeView
      tournaments={list}
      initialMatches={matches}
      teams={teams}
      standings={standings}
      liveSync
    />
  )
}
