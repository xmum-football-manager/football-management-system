import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { isAdmin, isOrganizer } from '@/lib/db/roles'
import { getTournament } from '@/lib/db/tournaments'
import { listTeams, listPlayerCounts } from '@/lib/db/teams'
import { listMatches } from '@/lib/db/matches'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'
import { allGroupMatchesFinished } from '@/lib/overview-utils'
import { TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge'
import { TournamentNav } from './TournamentNav'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
  children: React.ReactNode
}

export async function generateMetadata({ params }: Pick<Props, 'params'>) {
  const { id } = await params
  const tournament = await getTournament(id)
  return { title: tournament ? `${tournament.name} — Admin` : 'Tournament Admin' }
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

  const [teams, playerCounts, matches] = await Promise.all([
    listTeams(id),
    listPlayerCounts(id),
    listMatches(id),
  ])

  const readiness = checkTournamentReadiness(
    teams,
    playerCounts,
    tournament.min_players_per_team,
    tournament.format,
    tournament.num_groups,
    tournament.teams_per_group,
  )

  // RD fixtures locked when teams aren't ready
  const teamsReady = readiness.canGenerateFixtures
  const rdFixturesLocked = !teamsReady
  const rdFixturesLockReason = !teamsReady
    ? readiness.blockingIssues.join(' ')
    : null

  // Groups tab only needs players ready — group assignment happens inside the tab
  const groupsTabLocked = !readiness.allPlayersReady
  const groupsTabLockReason = groupsTabLocked
    ? readiness.blockingIssues.filter(i => !i.includes('not assigned')).join(' ') || rdFixturesLockReason
    : null

  // KO teams locked when RD teams aren't ready (RR+KO only — in pure KO format, teams are set up directly)
  const rdGroupsProgress = (
    tournament.format === 'round_robin_knockout' &&
    (!readiness.allGroupsAssigned || !readiness.allGroupsFull)
  )
    ? 'Groups incomplete'
    : null

  // KO fixtures locked when teams aren't ready OR (for RR+KO) group stage not finished
  let koFixturesLocked = !teamsReady
  let koFixturesLockReason: string | null = !teamsReady
    ? readiness.blockingIssues.join(' ')
    : null
  if (tournament.format === 'round_robin_knockout' && !allGroupMatchesFinished(matches)) {
    koFixturesLocked = true
    koFixturesLockReason = 'Group stage must be finished before knockout fixtures.'
  }

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
        format={tournament.format}
        isAdmin={admin}
        teamsNeedsAttention={!teamsReady}
        groupsLocked={groupsTabLocked}
        groupsLockReason={groupsTabLockReason}
        groupsNeedsAttention={!!rdGroupsProgress}
        fixturesLocked={rdFixturesLocked}
        fixturesLockReason={rdFixturesLockReason}
        knockoutLocked={koFixturesLocked}
        knockoutLockReason={koFixturesLockReason}
      />

      {children}
    </div>
  )
}
