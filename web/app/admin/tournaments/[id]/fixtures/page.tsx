import { getTournament } from '@/lib/db/tournaments'
import { listTeams, listPlayerCounts } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { canAddFixture, canCreateFixtures, canManageTeams } from '@/lib/lock-rules'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { FixturesPanel } from './FixturesPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FixturesPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches, admin, playerCounts] = await Promise.all([
    listTeams(id),
    listMatches(id),
    isAdmin(user.id),
    listPlayerCounts(id),
  ])
  const canEdit = canAddFixture(tournament.status)
  const anyMatchActive = matches.some((m) => m.status !== 'scheduled')
  const canCreate = canCreateFixtures(tournament.status, anyMatchActive)
  const canAssignGroups = canManageTeams(tournament.status) && !anyMatchActive
  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
  )

  return (
    <FixturesPanel
      tournamentId={id}
      tournamentStart={tournament.start_date}
      tournamentEnd={tournament.end_date}
      tournamentFormat={tournament.format}
      tournamentStatus={tournament.status}
      isAdmin={admin}
      teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
      matches={matches}
      canEdit={canEdit}
      canCreateFixtures={canCreate && readiness.canGenerateFixtures}
      canAssignGroups={canAssignGroups}
      readinessIssues={readiness.blockingIssues}
      numGroups={tournament.num_groups}
      teamsPerGroup={tournament.teams_per_group}
      advancePerGroup={tournament.advance_per_group}
      knockoutQualifiers={tournament.knockout_qualifiers ?? null}
      knockoutSlots={
        tournament.format === 'round_robin_knockout' &&
        tournament.num_groups != null &&
        tournament.advance_per_group != null
          ? tournament.num_groups * tournament.advance_per_group
          : 0
      }
    />
  )
}
