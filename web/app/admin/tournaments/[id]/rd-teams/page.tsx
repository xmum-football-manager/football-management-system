import { listTeamsWithPlayers } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { canManageTeams } from '@/lib/lock-rules'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { TeamsPanel } from '../teams/TeamsPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RDTeamsPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches] = await Promise.all([listTeamsWithPlayers(id), listMatches(id)])
  const anyMatchActive = matches.some((m) => m.status !== 'scheduled')
  const canEdit = canManageTeams(tournament.status) && !anyMatchActive

  const playerCounts: Record<string, number> = {}
  for (const t of teams) {
    playerCounts[t.id] = t.players.length
  }
  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
    tournament.teams_per_group,
  )
  const readinessMessage = readiness.allPlayersReady ? null : readiness.blockingIssues.find(i => !i.includes('not assigned') && !i.includes('Group ')) ?? null

  return (
    <TeamsPanel
      tournamentId={id}
      initialTeams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        group_label: t.group_label,
        players: t.players.map((p) => ({
          id: p.id,
          name: p.name,
          jersey_number: p.jersey_number,
          position: p.position,
        })),
      }))}
      canEdit={canEdit}
      minPlayersPerTeam={tournament.min_players_per_team}
      format={tournament.format}
      phase="rd"
      readinessMessage={readinessMessage}
    />
  )
}
