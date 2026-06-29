import Link from 'next/link'
import { listMatches } from '@/lib/db/matches'
import { listTeams } from '@/lib/db/teams'
import { listPlayers } from '@/lib/db/players'
import { getTournament } from '@/lib/db/tournaments'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { canAddFixture } from '@/lib/lock-rules'
import { shouldShowKnockoutCTA } from '@/lib/overview-utils'
import { phaseSchedulingStatus } from '@/lib/phase-schedule-guard'
import { listPlayerCardCountsByTournament } from '@/lib/db/cards'
import { MatchViews } from '@/components/admin/MatchViews'
import { MatchDayCard } from './MatchDayCard'
import { UpNextRow } from './UpNextRow'
import { PlayerCardsTable } from './PlayerCardsTable'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OverviewPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const admin = await isAdmin(user.id)

  const [matches, teams, playerCards] = await Promise.all([
    listMatches(id),
    listTeams(id),
    listPlayerCardCountsByTournament(id).catch(() => []),
  ])

  const played = matches.filter((m) => m.status === 'finished').length
  const liveMatch = matches.find((m) => m.status === 'live' || m.status === 'halftime') ?? null

  // Fetch rosters for live match if present
  const liveMatchRosters = liveMatch
    ? await Promise.all([
        listPlayers(liveMatch.home_team_id ?? ''),
        listPlayers(liveMatch.away_team_id ?? ''),
      ])
    : null
  const hasLiveMatch = liveMatch !== null
  const remaining = matches.length - played
  const canManageFixtures = canAddFixture(tournament.status)

  const showKnockoutCTA = shouldShowKnockoutCTA(tournament.format, matches)

  const timedUpNext = matches
    .filter((m) => m.status === 'scheduled' && m.match_time !== null)
    .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
    .at(0) ?? null

  const upNext =
    timedUpNext ??
    matches.find((m) => m.status === 'scheduled' && m.phase === 'knockout') ??
    null

  const phaseScheduled = phaseSchedulingStatus(matches)
  const upNextKickoffBlocked = upNext
    ? !(phaseScheduled[upNext.phase as 'group' | 'knockout'] ?? true)
    : false

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Matches" value={matches.length} />
        <StatTile label="Played" value={played} />
        <StatTile label="Live now" value={hasLiveMatch ? 1 : 0} live={hasLiveMatch} />
      </div>

      {showKnockoutCTA && (
        <KnockoutCTA tournamentId={id} />
      )}

      {liveMatch && (
        <MatchDayCard
          match={liveMatch}
          isAdmin={admin}
          halftimeEnabled={tournament.halftime_enabled}
          homePlayers={liveMatchRosters?.[0] ?? []}
          awayPlayers={liveMatchRosters?.[1] ?? []}
        />
      )}

      {upNext && canManageFixtures && (
        <div>
          <p className="admin-eyebrow mb-2">{hasLiveMatch ? 'Up next' : 'Next up'}</p>
          <UpNextRow match={upNext} isAdmin={admin} hasLiveMatch={hasLiveMatch} kickoffBlocked={upNextKickoffBlocked} />
        </div>
      )}


      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="admin-eyebrow">Matches</p>
          <span className="admin-mono text-[11px] text-muted-foreground">
            {matches.length} total · {remaining} remaining
          </span>
        </div>
        <MatchViews
          tournamentId={id}
          tournamentFormat={tournament.format}
          tournamentStatus={tournament.status}
          isAdmin={admin}
          canManageFixtures={canManageFixtures}
          numGroups={tournament.num_groups}
          advancePerGroup={tournament.advance_per_group}
          teams={teams.map((t) => ({ id: t.id, name: t.name, group_label: t.group_label }))}
          matches={matches}
          tournamentStart={tournament.start_date}
          tournamentEnd={tournament.end_date}
        />
      </div>

      <PlayerCardsTable rows={playerCards} />
    </div>
  )
}

function KnockoutCTA({ tournamentId }: { tournamentId: string }) {
  return (
    <div
      className="rounded-xl border p-4 flex items-center justify-between gap-4"
      style={{
        borderColor: 'var(--admin-lime)',
        background: 'color-mix(in srgb, var(--admin-lime) 6%, transparent)',
      }}
    >
      <div>
        <p className="admin-eyebrow" style={{ color: 'var(--admin-lime)' }}>Group stage complete</p>
        <p className="mt-1 text-sm text-muted-foreground">All group matches are done. Set up the knockout bracket to continue.</p>
      </div>
      <Link
        href={`/admin/tournaments/${tournamentId}/knockout`}
        className="shrink-0 rounded-lg px-4 py-2 text-[12px] font-semibold admin-tab tracking-wider transition-colors"
        style={{
          background: 'var(--admin-lime)',
          color: '#fff',
        }}
      >
        Set up Knockout
      </Link>
    </div>
  )
}

function StatTile({
  label,
  value,
  live,
}: {
  label: string
  value: number
  live?: boolean
}) {
  return (
    <div
      className="rounded-xl border bg-card p-4"
      style={{ borderColor: live ? '#DC2626' : 'var(--admin-rule)', background: live ? 'color-mix(in srgb, #DC2626 8%, transparent)' : undefined }}
    >
      <div className="admin-eyebrow">{label}</div>
      <div
        className="admin-display admin-mono mt-2 flex items-center gap-2.5"
        style={{
          fontSize: 36,
          lineHeight: 1,
          color: live ? '#DC2626' : 'var(--foreground)',
        }}
      >
        {value}
        {live ? (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-[#DC2626]"
            style={{ boxShadow: '0 0 0 4px rgba(220,38,38,0.18)' }}
          />
        ) : null}
      </div>
    </div>
  )
}
