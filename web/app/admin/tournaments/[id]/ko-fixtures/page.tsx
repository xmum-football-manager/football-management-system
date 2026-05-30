import { getTournament } from '@/lib/db/tournaments'
import { listTeams, listPlayerCounts } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { canAddFixture, canCreateFixtures } from '@/lib/lock-rules'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { FixturesPanel } from '../fixtures/FixturesPanel'

interface Props {
  params: Promise<{ id: string }>
}

function isGroupStageMatch(m: { home_team: { group_label: string | null }; away_team: { group_label: string | null } }): boolean {
  const h = m.home_team.group_label
  const a = m.away_team.group_label
  return !!h && !!a && h === a
}

export default async function KOFixturesPage({ params }: Props) {
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

  // For round_robin_knockout, only show knockout matches
  const displayMatches = tournament.format === 'round_robin_knockout'
    ? matches.filter((m) => !isGroupStageMatch(m))
    : matches

  const canEdit = canAddFixture(tournament.status)
  const anyMatchActive = displayMatches.some((m) => m.status !== 'scheduled')
  const canCreate = canCreateFixtures(tournament.status, anyMatchActive)
  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
    tournament.teams_per_group,
  )

  // For round_robin_knockout, check if group stage is complete
  const groupMatches = tournament.format === 'round_robin_knockout'
    ? matches.filter(isGroupStageMatch)
    : []
  const allGroupFinished = groupMatches.length > 0
    && groupMatches.every((m) => m.status === 'finished')

  // Effective format for fixture panel
  const effectiveFormat = tournament.format === 'round_robin_knockout'
    ? 'knockout' as const
    : tournament.format

  const knockoutSlots =
    tournament.format === 'round_robin_knockout' &&
    tournament.num_groups != null &&
    tournament.advance_per_group != null
      ? tournament.num_groups * tournament.advance_per_group
      : 0

  // Block fixture creation if group stage isn't done in RR+KO
  const koCanCreate = tournament.format === 'round_robin_knockout'
    ? canCreate && readiness.canGenerateFixtures && allGroupFinished
    : canCreate && readiness.canGenerateFixtures

  const koIssues = [...readiness.blockingIssues]
  if (tournament.format === 'round_robin_knockout' && !allGroupFinished) {
    koIssues.push('Group stage must be finished before knockout fixtures.')
  }

  return (
    <FixturesPanel
      tournamentId={id}
      tournamentStart={tournament.start_date}
      tournamentEnd={tournament.end_date}
      tournamentFormat={effectiveFormat}
      tournamentStatus={tournament.status}
      isAdmin={admin}
      teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
      matches={displayMatches}
      canEdit={canEdit}
      canCreateFixtures={koCanCreate}
      canAssignGroups={false}
      readinessIssues={koIssues}
      numGroups={tournament.num_groups}
      teamsPerGroup={tournament.teams_per_group}
      advancePerGroup={tournament.advance_per_group}
      knockoutQualifiers={tournament.knockout_qualifiers ?? null}
      knockoutSlots={knockoutSlots}
    />
  )
}
