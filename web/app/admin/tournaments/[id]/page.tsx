import { listMatches } from '@/lib/db/matches'
import { listTeams } from '@/lib/db/teams'
import { getTournament } from '@/lib/db/tournaments'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { Card, CardContent } from '@/components/ui/card'
import { MatchRow } from './MatchRow'

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Teams" value={teams.length} />
        <StatCard label="Matches" value={matches.length} />
        <StatCard label="Played" value={played} />
        <StatCard label="Live now" value={live} accent={live > 0 ? 'live' : undefined} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Matches ({matches.length})
        </h2>
        {matches.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No matches yet. Add teams, then schedule fixtures.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id}>
                <MatchRow match={m} tournamentStatus={tournament.status} isAdmin={admin} />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {remaining} match{remaining === 1 ? '' : 'es'} remaining.
        </p>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: 'live'
}) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-2xl font-bold ${accent === 'live' ? 'text-emerald-600' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
