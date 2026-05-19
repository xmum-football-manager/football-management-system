import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TournamentView } from './TournamentView'
import { getTournament } from '@/lib/db/tournaments'
import { getMatches } from '@/lib/db/matches'
import { getTeams } from '@/lib/db/teams'
import { getTournamentStandings } from '@/lib/db/standings'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const t = await getTournament(supabase, id)
  if (!t) return { title: 'Tournament Not Found' }
  return {
    title: `${t.name} — Live Scores`,
    description: t.description || `Follow ${t.name} live scores, standings, and fixtures.`,
  }
}

export default async function TournamentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [tournament, matches, standings, teams] = await Promise.all([
    getTournament(supabase, id),
    getMatches(supabase, id),
    getTournamentStandings(supabase, id),
    getTeams(supabase, id),
  ])

  if (!tournament) notFound()

  return (
    <TournamentView
      tournament={tournament}
      initialMatches={matches}
      initialStandings={standings}
      initialTeams={teams}
    />
  )
}
