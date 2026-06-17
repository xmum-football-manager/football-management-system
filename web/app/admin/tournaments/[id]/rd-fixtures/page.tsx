import { getTournament } from '@/lib/db/tournaments'
import { listTeams, listPlayerCounts } from '@/lib/db/teams'
import { listMatchesAdmin } from '@/lib/db/matches'
import { canAddFixture, canManageTeams } from '@/lib/lock-rules'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { FixturesPanel } from '../fixtures/FixturesPanel'
import { GenerateGroupFixturesButton } from './GenerateGroupFixturesButton'
import { FixtureSchedulerPanel } from './FixtureSchedulerPanel'
import { isGroupPhaseMatch } from '@/lib/match-lifecycle'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RDFixturesPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches, playerCounts, admin] = await Promise.all([
    listTeams(id),
    listMatchesAdmin(id),
    listPlayerCounts(id),
    isAdmin(user.id),
  ])

  // For round_robin_knockout, only show group matches
  const displayMatches = tournament.format === 'round_robin_knockout'
    ? matches.filter(isGroupPhaseMatch)
    : matches

  const canEdit = canAddFixture(tournament.status)
  const anyMatchActive = displayMatches.some((m) => m.status !== 'scheduled')
  const canAssignGroups = canManageTeams(tournament.status) && !anyMatchActive

  // Readiness check — only used to gate the generate button
  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
    tournament.teams_per_group,
  )
  const canGenerate = canEdit && displayMatches.length === 0 && readiness.canGenerateFixtures

  // For round_robin_knockout, treat as round_robin for MatchViews rendering
  const effectiveFormat = tournament.format === 'round_robin_knockout'
    ? 'round_robin' as const
    : tournament.format

  const showScheduler =
    tournament.format === 'round_robin_knockout' &&
    canEdit &&
    displayMatches.length > 0

  return (
    <div className="space-y-5">
      {tournament.format === 'round_robin_knockout' && canGenerate && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            All groups are ready. Generate the round-robin fixtures for each group.
          </p>
          <GenerateGroupFixturesButton tournamentId={id} />
        </div>
      )}

      {showScheduler && (
        <FixtureSchedulerPanel
          tournamentId={id}
          initialMatches={displayMatches}
          startDate={tournament.start_date}
          endDate={tournament.end_date}
          minutesPerHalf={tournament.minutes_per_half}
          halftimeEnabled={tournament.halftime_enabled}
          halftimeMinutes={tournament.halftime_minutes}
        />
      )}

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
        canAssignGroups={canAssignGroups}
        numGroups={tournament.num_groups}
        advancePerGroup={tournament.advance_per_group}
        knockoutQualifiers={tournament.knockout_qualifiers ?? null}
        knockoutSlots={0}
        hideTabs
      />
    </div>
  )
}
