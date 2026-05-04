import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentView } from './TournamentView'
import type { Tournament, MatchWithTeams, Standing, Team, Player } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: t } = await supabase.from('tournaments').select('name, description').eq('id', id).single()
  if (!t) return { title: 'Tournament Not Found' }
  return {
    title: `${t.name} — Live Scores`,
    description: t.description || `Follow ${t.name} live scores, standings, and fixtures.`,
  }
}

export default async function TournamentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [tournamentRes, matchesRes, standingsRes, teamsRes] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .eq('tournament_id', id).order('match_time', { ascending: true }),
    supabase.from('standings').select('*').eq('tournament_id', id),
    supabase.from('teams').select('*, players(*)').eq('tournament_id', id).order('name'),
  ])

  if (!tournamentRes.data) notFound()

  return (
    <TournamentView
      tournament={tournamentRes.data as Tournament}
      initialMatches={(matchesRes.data ?? []) as MatchWithTeams[]}
      initialStandings={(standingsRes.data ?? []) as Standing[]}
      initialTeams={(teamsRes.data ?? []) as Array<Team & { players: Player[] }>}
    />
  )
}
