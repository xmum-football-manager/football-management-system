import { getTournament } from '@/lib/db/tournaments'
import { listTeams } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { canAddFixture } from '@/lib/lock-rules'
import { FixturesPanel } from './FixturesPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FixturesPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches] = await Promise.all([listTeams(id), listMatches(id)])
  const canEdit = canAddFixture(tournament.status)

  return (
    <FixturesPanel
      tournamentId={id}
      tournamentStart={tournament.start_date}
      tournamentFormat={tournament.format}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      matches={matches.map((m) => ({
        id: m.id,
        match_time: m.match_time,
        status: m.status,
        home_score: m.home_score,
        away_score: m.away_score,
        home_team: { id: m.home_team.id, name: m.home_team.name },
        away_team: { id: m.away_team.id, name: m.away_team.name },
      }))}
      canEdit={canEdit}
    />
  )
}
