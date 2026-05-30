import { listTeamsWithPlayers } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { canManageTeams } from '@/lib/lock-rules'
import { notFound } from 'next/navigation'
import { RDGroupsPanel } from './RDGroupsPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RDGroupsPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) notFound()
  if (tournament.format !== 'round_robin_knockout') notFound()
  if (!tournament.num_groups) notFound()

  const [teams, matches] = await Promise.all([listTeamsWithPlayers(id), listMatches(id)])
  const anyMatchActive = matches.some(m => m.status !== 'scheduled')
  const canEdit = canManageTeams(tournament.status) && !anyMatchActive

  return (
    <RDGroupsPanel
      tournamentId={id}
      initialTeams={teams.map(t => ({
        id: t.id,
        name: t.name,
        group_label: t.group_label,
      }))}
      numGroups={tournament.num_groups}
      teamsPerGroup={tournament.teams_per_group}
      canEdit={canEdit}
    />
  )
}
