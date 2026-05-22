import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { listTournamentsForUser } from '@/lib/db/tournaments'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge'
import { formatRange } from '@/lib/format'
import { Plus, MapPin, Calendar } from 'lucide-react'

export default async function AdminHome() {
  const user = await requireUser()
  const admin = await isAdmin(user.id)
  const tournaments = await listTournamentsForUser(user.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {admin ? 'All Tournaments' : 'Your Tournaments'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {admin
              ? 'Every tournament in the system.'
              : 'Tournaments you can manage.'}
          </p>
        </div>
        {admin && (
          <Link href="/admin/tournaments/new">
            <Button>
              <Plus className="h-4 w-4" /> New Tournament
            </Button>
          </Link>
        )}
      </div>

      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No tournaments yet. {admin ? 'Create one to get started.' : 'Ask an admin to assign you to a tournament.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/admin/tournaments/${t.id}`} className="group">
              <Card className="transition-shadow group-hover:shadow-md">
                <CardContent className="py-5 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base truncate">{t.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {formatRange(t.start_date, t.end_date)}
                        </span>
                        {t.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {t.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{formatLabel(t.format)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function formatLabel(f: string): string {
  switch (f) {
    case 'round_robin':
      return 'Round-robin'
    case 'knockout':
      return 'Knockout'
    case 'round_robin_knockout':
      return 'Group → Knockout'
    default:
      return f
  }
}
