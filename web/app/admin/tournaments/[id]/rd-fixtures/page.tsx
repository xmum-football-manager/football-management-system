import { getTournament } from '@/lib/db/tournaments'
import { listTeams } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { canAddFixture, canManageTeams } from '@/lib/lock-rules'
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

export default async function RDFixturesPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches, admin] = await Promise.all([
    listTeams(id),
    listMatches(id),
    isAdmin(user.id),
  ])

  // For round_robin_knockout, only show group matches
  const displayMatches = tournament.format === 'round_robin_knockout'
    ? matches.filter(isGroupStageMatch)
    : matches

  const canEdit = canAddFixture(tournament.status)
  const anyMatchActive = displayMatches.some((m) => m.status !== 'scheduled')
  const canAssignGroups = canManageTeams(tournament.status) && !anyMatchActive

  // For round_robin_knockout, treat as round_robin for MatchViews rendering
  const effectiveFormat = tournament.format === 'round_robin_knockout'
    ? 'round_robin' as const
    : tournament.format

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
      canAssignGroups={canAssignGroups}
      numGroups={tournament.num_groups}
      advancePerGroup={tournament.advance_per_group}
      knockoutQualifiers={tournament.knockout_qualifiers ?? null}
      knockoutSlots={0}
    />
  )
}
