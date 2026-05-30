import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listTeams, listPlayerCounts } from '@/lib/db/teams'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
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

  const [teams, playerCounts] = await Promise.all([
    listTeams(id),
    listPlayerCounts(id),
  ])

  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
  )

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin"
          className="admin-eyebrow inline-flex items-center gap-1 hover:text-foreground"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ArrowLeft className="h-3 w-3" /> Dashboard
        </Link>
        <p className="admin-eyebrow mt-3">Tournament</p>
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <h1 className="admin-display text-[40px] leading-none truncate">{tournament.name}</h1>
          <TournamentStatusBadge status={tournament.status} />
        </div>
        {tournament.location && (
          <p className="mt-2 text-sm text-muted-foreground">{tournament.location}</p>
        )}
      </div>

      <TournamentNav
        tournamentId={id}
        isAdmin={admin}
        teamsProgress={
          !readiness.canGenerateFixtures
            ? `${readiness.teamsWithEnoughPlayers}/${readiness.totalTeams} teams ready`
            : null
        }
        fixturesLocked={!readiness.canGenerateFixtures}
        fixturesLockReason={
          !readiness.canGenerateFixtures
            ? readiness.blockingIssues.join(' ')
            : null
        }
      />

      {children}
    </div>
  )
}
