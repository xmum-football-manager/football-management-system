import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { listScorekeeperRoles } from '@/lib/db/roles'
import { createServiceClient } from '@/lib/supabase/server'
import { ScorekeepersPanel } from './ScorekeepersPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ScorekeepersPage({ params }: Props) {
  const { id } = await params
  const tournament = await getTournament(id)
  if (!tournament) return null
  const [matches, roles] = await Promise.all([listMatches(id), listScorekeeperRoles(id)])

  // Resolve email addresses via service role
  const svc = createServiceClient()
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
  const emails = new Map<string, string>()
  for (const u of data?.users ?? []) {
    if (u.email) emails.set(u.id, u.email)
  }

  const assignments = roles.map((r) => {
    const match = r.match_id ? matches.find((m) => m.id === r.match_id) : null
    return {
      id: r.id,
      userId: r.user_id,
      email: emails.get(r.user_id) ?? '(unknown)',
      scope: r.tournament_id ? ('tournament' as const) : ('match' as const),
      matchLabel: match ? `${match.home_team.name} vs ${match.away_team.name}` : null,
    }
  })

  return (
    <ScorekeepersPanel
      tournamentId={id}
      matches={matches
        .filter((m) => m.status !== 'finished')
        .map((m) => ({
          id: m.id,
          label: `${m.home_team.name} vs ${m.away_team.name}`,
          time: m.match_time,
        }))}
      assignments={assignments}
    />
  )
}
