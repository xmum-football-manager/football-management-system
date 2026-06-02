import { getTournament } from '@/lib/db/tournaments'
import { listTeams } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { canAddFixture } from '@/lib/lock-rules'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { FixturesPanel } from '../fixtures/FixturesPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function KOFixturesPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [teams, matches, admin] = await Promise.all([
    listTeams(id),
    listMatches(id),
    isAdmin(user.id),
  ])

  // For round_robin_knockout, only show knockout matches (use authoritative phase column)
  const displayMatches = tournament.format === 'round_robin_knockout'
    ? matches.filter((m) => m.phase === 'knockout')
    : matches

  const canEdit = canAddFixture(tournament.status)

  const knockoutSlots =
    tournament.format === 'round_robin_knockout' &&
    tournament.num_groups != null &&
    tournament.advance_per_group != null
      ? tournament.num_groups * tournament.advance_per_group
      : 0

  // For round_robin_knockout, treat as knockout for MatchViews rendering
  const effectiveFormat = tournament.format === 'round_robin_knockout'
    ? 'knockout' as const
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
      canAssignGroups={false}
      numGroups={tournament.num_groups}
      advancePerGroup={tournament.advance_per_group}
      knockoutQualifiers={tournament.knockout_qualifiers ?? null}
      knockoutSlots={knockoutSlots}
    />
  )
}
