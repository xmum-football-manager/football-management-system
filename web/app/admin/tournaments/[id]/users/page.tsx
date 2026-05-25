import { requireUser } from '@/lib/auth'
import { isAdmin, listOrganizerRoles, listScorekeeperRoles } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listMatches } from '@/lib/db/matches'
import { createServiceClient } from '@/lib/supabase/server'
import { UsersPanel } from './UsersPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function UsersPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null

  const admin = await isAdmin(user.id)

  const svc = createServiceClient()
  const [matches, scorekeeperRoles, organizerRoles, { data: authData }] = await Promise.all([
    listMatches(id),
    listScorekeeperRoles(id),
    admin ? listOrganizerRoles(id) : Promise.resolve([]),
    svc.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ])

  const emails = new Map<string, string>()
  for (const u of authData?.users ?? []) {
    if (u.email) emails.set(u.id, u.email)
  }

  const organizers = organizerRoles.map((r) => ({
    id: r.id,
    email: emails.get(r.user_id) ?? '(unknown)',
  }))

  const scorekeeperAssignments = scorekeeperRoles.map((r) => {
    const match = r.match_id ? matches.find((m) => m.id === r.match_id) : null
    return {
      id: r.id,
      email: emails.get(r.user_id) ?? '(unknown)',
      scope: r.tournament_id ? ('tournament' as const) : ('match' as const),
      matchLabel: match ? `${match.home_team.name} vs ${match.away_team.name}` : null,
    }
  })

  return (
    <UsersPanel
      tournamentId={id}
      isAdmin={admin}
      organizers={organizers}
      matches={matches
        .filter((m) => m.status !== 'finished')
        .map((m) => ({
          id: m.id,
          label: `${m.home_team.name} vs ${m.away_team.name}`,
          time: m.match_time,
        }))}
      scorekeeperAssignments={scorekeeperAssignments}
    />
  )
}
