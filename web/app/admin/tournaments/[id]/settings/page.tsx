import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
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

  return (
    <SettingsPanel
      tournamentId={id}
      tournament={tournament}
      isAdmin={admin}
    />
  )
}
