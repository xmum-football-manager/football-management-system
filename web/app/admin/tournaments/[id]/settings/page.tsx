import { requireUser } from '@/lib/auth'
import { isAdmin, listOrganizerRoles } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { createServiceClient } from '@/lib/supabase/server'
import { SettingsPanel } from './SettingsPanel'

interface Props {
  params: Promise<{ id: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const admin = await isAdmin(user.id)

  const organizerRoles = admin ? await listOrganizerRoles(id) : []
  let organizers: { id: string; email: string }[] = []
  if (admin) {
    const svc = createServiceClient()
    const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 })
    const emails = new Map<string, string>()
    for (const u of data?.users ?? []) {
      if (u.email) emails.set(u.id, u.email)
    }
    organizers = organizerRoles.map((r) => ({
      id: r.id,
      email: emails.get(r.user_id) ?? '(unknown)',
    }))
  }

  return (
    <SettingsPanel
      tournamentId={id}
      tournament={tournament}
      isAdmin={admin}
      organizers={organizers}
    />
  )
}
