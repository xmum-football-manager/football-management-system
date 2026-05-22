import { listMatches } from '@/lib/db/matches'
import { listTeams } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { canAddFixture } from '@/lib/lock-rules'
import { MatchViews } from '@/components/admin/MatchViews'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OverviewPage({ params }: Props) {
  const { id } = await params
  const user = await requireUser()
  const tournament = await getTournament(id)
  if (!tournament) return null
  const admin = await isAdmin(user.id)

  const [matches, teams] = await Promise.all([listMatches(id), listTeams(id)])

  const played = matches.filter((m) => m.status === 'finished').length
  const live = matches.filter((m) => m.status === 'live' || m.status === 'halftime').length
  const remaining = matches.length - played
  const canManageFixtures = canAddFixture(tournament.status)

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Teams" value={teams.length} />
        <StatTile label="Matches" value={matches.length} />
        <StatTile label="Played" value={played} />
        <StatTile label="Live now" value={live} live={live > 0} />
      </div>

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
        />
      </div>
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
      style={{ borderColor: 'var(--admin-rule)' }}
    >
      <div className="admin-eyebrow">{label}</div>
      <div
        className="admin-display admin-mono mt-2 flex items-center gap-2.5"
        style={{
          fontSize: 36,
          lineHeight: 1,
          color: live ? 'var(--admin-lime)' : 'var(--foreground)',
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
