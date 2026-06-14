import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import './tournament.css'
import { withTeamFallback } from '@/lib/match-teams'
import { TournamentView } from './TournamentView'
import { listTopScorers } from '@/lib/db/goals'
import { listTeamCardCountsByTournament } from '@/lib/db/cards'
import type { Tournament, MatchWithTeams, Standing, Team, Player } from '@/lib/supabase/types'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: t } = await supabase.from('tournaments').select('name, description').eq('id', id).single()
  if (!t) return { title: 'Tournament Not Found' }
  const description = t.description || `Follow ${t.name} live scores, standings, and fixtures.`
  return {
    title: `${t.name} — Live Scores`,
    description,
    openGraph: {
      title: `${t.name} — Live Scores`,
      description,
      siteName: 'Pitch',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${t.name} — Live Scores`,
      description,
    },
  }
}

export default async function TournamentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [tournamentRes, matchesRes, standingsRes, teamsRes] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase.from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .eq('tournament_id', id).order('match_time', { ascending: false }),
    supabase.from('standings').select('*').eq('tournament_id', id),
    supabase.from('teams').select('*, players(*)').eq('tournament_id', id).order('name'),
  ])

  if (!tournamentRes.data) notFound()

  const [topScorers, cardCounts] = await Promise.all([
    listTopScorers(id).catch(() => []),
    listTeamCardCountsByTournament(id).catch(() => []),
  ])

  return (
    <TournamentView
      tournament={tournamentRes.data as Tournament}
      initialMatches={withTeamFallback((matchesRes.data ?? []) as MatchWithTeams[])}
      initialStandings={(standingsRes.data ?? []) as Standing[]}
      initialTeams={(teamsRes.data ?? []) as Array<Team & { players: Player[] }>}
      topScorers={topScorers}
      cardCounts={cardCounts}
    />
  )
}
