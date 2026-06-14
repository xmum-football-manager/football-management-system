import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listTeams } from '@/lib/db/teams'
import { listMatchesAdmin } from '@/lib/db/matches'
import { canAddFixture } from '@/lib/lock-rules'
import { computeGroupStandings } from '@/lib/qualifiers'
import { notFound } from 'next/navigation'
import { KnockoutStepper } from './KnockoutStepper'

interface Props {
  params: Promise<{ id: string }>
}

export default async function KnockoutPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) notFound()
  if (tournament.format !== 'round_robin_knockout') notFound()

  const [teams, matches, admin] = await Promise.all([
    listTeams(id),
    listMatchesAdmin(id),
    isAdmin(user.id),
  ])

  // Phase is the source of truth — NOT a group_label heuristic. A knockout match can
  // pair two teams from the same group (e.g. 4-team semis), which a group_label check
  // would mis-flag as a group match and hide the bracket.
  const groupMatches = matches.filter((m) => m.phase === 'group')
  const knockoutMatches = matches.filter((m) => m.phase === 'knockout')

  const standings = tournament.num_groups && tournament.advance_per_group
    ? computeGroupStandings(
        teams,
        groupMatches.filter(
          (m): m is typeof m & { home_team_id: string; away_team_id: string } =>
            m.home_team_id !== null && m.away_team_id !== null,
        ),
        tournament.num_groups,
        tournament.advance_per_group,
      )
    : []

  const canEdit = canAddFixture(tournament.status)

  return (
    <KnockoutStepper
      tournamentId={id}
      standings={standings}
      savedQualifiers={tournament.knockout_qualifiers ?? null}
      advancePerGroup={tournament.advance_per_group ?? 1}
      numGroups={tournament.num_groups ?? 1}
      knockoutMatches={knockoutMatches}
      teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
      isAdmin={admin}
      canEdit={canEdit}
      tournamentStart={tournament.start_date}
      tournamentEnd={tournament.end_date}
    />
  )
}
