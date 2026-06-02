import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listTeamsWithPlayers } from '@/lib/db/teams'
import { listMatchesAdmin } from '@/lib/db/matches'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { canManageTeams, canAddFixture } from '@/lib/lock-rules'
import { notFound } from 'next/navigation'
import { GroupsStepper } from './GroupsStepper'

interface Props {
  params: Promise<{ id: string }>
}

function isGroupMatch(m: { home_team: { group_label: string | null } | null; away_team: { group_label: string | null } | null }) {
  const h = m.home_team?.group_label
  const a = m.away_team?.group_label
  return !!h && !!a && h === a
}

export default async function GroupsPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) notFound()
  if (tournament.format !== 'round_robin_knockout') notFound()
  if (!tournament.num_groups) notFound()

  const [teams, matches, admin] = await Promise.all([
    listTeamsWithPlayers(id),
    listMatchesAdmin(id),
    isAdmin(user.id),
  ])

  const groupMatches = matches.filter(isGroupMatch)

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

  const anyMatchActive = groupMatches.some((m) => m.status !== 'scheduled')
  const canManageGroups = canManageTeams(tournament.status) && !anyMatchActive
  const canEdit = canAddFixture(tournament.status)
  const canGenerate = canEdit && groupMatches.length === 0 && readiness.canGenerateFixtures
  const showScheduler = canEdit && groupMatches.length > 0
  const allFixturesScheduled =
    groupMatches.length > 0 && groupMatches.every((m) => m.match_time !== null)

  return (
    <GroupsStepper
      tournamentId={id}
      teams={teams.map((t) => ({
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
      numGroups={tournament.num_groups}
      teamsPerGroup={tournament.teams_per_group}
      canManageGroups={canManageGroups}
      matches={groupMatches}
      startDate={tournament.start_date}
      endDate={tournament.end_date}
      minutesPerHalf={tournament.minutes_per_half}
      halftimeEnabled={tournament.halftime_enabled}
      halftimeMinutes={tournament.halftime_minutes}
      tournamentStatus={tournament.status}
      numGroupsForPanel={tournament.num_groups}
      advancePerGroup={tournament.advance_per_group}
      knockoutQualifiers={tournament.knockout_qualifiers ?? null}
      isAdmin={admin}
      canEdit={canEdit}
      canGenerate={canGenerate}
      showScheduler={showScheduler}
      allGroupsAssigned={readiness.allGroupsAssigned}
      allGroupsFull={readiness.allGroupsFull}
      fixturesExist={groupMatches.length > 0}
      allFixturesScheduled={allFixturesScheduled}
    />
  )
}
