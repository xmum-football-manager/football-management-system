import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge'
import { TournamentNav } from './TournamentNav'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export default async function TournamentLayout({ params, children }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) notFound()

  const admin = await isAdmin(user.id)
  const organizer = admin || (await isOrganizer(user.id, id))
  if (!organizer) {
    return (
      <div className="text-sm text-muted-foreground">
        You don&apos;t have access to this tournament.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-1 mb-1"
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight truncate">{tournament.name}</h1>
          <TournamentStatusBadge status={tournament.status} />
        </div>
        {tournament.location && (
          <p className="text-sm text-muted-foreground mt-0.5">{tournament.location}</p>
        )}
      </div>

      <TournamentNav tournamentId={id} isAdmin={admin} />

      {children}
    </div>
  )
}
