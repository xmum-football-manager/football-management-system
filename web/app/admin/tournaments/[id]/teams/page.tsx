import { listTeamsWithPlayers } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { canManageTeams } from '@/lib/lock-rules'
import { TeamsPanel } from './TeamsPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function TeamsPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches] = await Promise.all([listTeamsWithPlayers(id), listMatches(id)])
  const anyMatchActive = matches.some((m) => m.status !== 'scheduled')
  const canEdit = canManageTeams(tournament.status) && !anyMatchActive
  return (
    <TeamsPanel
      tournamentId={id}
      initialTeams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        players: t.players.map((p) => ({
          id: p.id,
          name: p.name,
          jersey_number: p.jersey_number,
          position: p.position,
        })),
      }))}
      canEdit={canEdit}
      minPlayersPerTeam={tournament.min_players_per_team}
    />
  )
}
