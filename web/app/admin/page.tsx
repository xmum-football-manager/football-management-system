import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { isAdmin } from '@/lib/db/roles'
import { listTournamentsForUser } from '@/lib/db/tournaments'
import { Button } from '@/components/ui/button'
import { TournamentStatusBadge } from '@/components/admin/TournamentStatusBadge'
import { formatRange } from '@/lib/format'
import { Calendar, ChevronRight, MapPin, Plus } from 'lucide-react'

export default async function AdminHome() {
  const user = await requireUser()
  const admin = await isAdmin(user.id)
  const all = await listTournamentsForUser(user.id, admin)
  // Surface order: live → setup → finished/archived (ties keep start-date order)
  const STATUS_RANK: Record<string, number> = { active: 0, setup: 1, finished: 2, archived: 3 }
  const tournaments = [...all].sort(
    (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9),
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="admin-eyebrow">Dashboard / Tournaments</p>
          <h1 className="admin-display mt-1.5 text-[36px] leading-none">
            {admin ? 'All Tournaments' : 'Your Tournaments'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {admin
              ? `${tournaments.length} total · sorted by status.`
              : 'Tournaments you can manage.'}
          </p>
        </div>
        {admin && (
          <Link href="/admin/tournaments/new">
            <Button className="admin-tab tracking-wider gap-2 rounded-md text-[12px] shadow-[0_6px_18px_-8px_rgba(14,26,18,0.6)]">
              <Plus className="h-4 w-4" /> New Tournament
            </Button>
          </Link>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div
          className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground"
          style={{ borderColor: 'var(--admin-rule)' }}
        >
          No tournaments yet.{' '}
          {admin ? 'Create one to get started.' : 'Ask an admin to assign you to a tournament.'}
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border bg-card"
          style={{ borderColor: 'var(--admin-rule)' }}
        >
          <div
            className="admin-eyebrow grid items-center gap-3 px-5 py-2.5 text-[10px] tracking-[0.5px] sm:gap-4 sm:text-[11px] sm:tracking-[1.5px] grid-cols-[minmax(0,1fr)_auto_16px] sm:grid-cols-[1fr_140px_130px_16px]"
            style={{
              background: 'var(--admin-surface-2)',
              borderBottom: '1px solid var(--admin-rule)',
              color: 'var(--muted-foreground)',
            }}
          >
            <div className="truncate whitespace-nowrap">Tournament</div>
            <div className="hidden text-right sm:block">Format</div>
            <div className="whitespace-nowrap text-right">Status</div>
            <div />
          </div>
          <ul>
            {tournaments.map((t, i) => (
              <li
                key={t.id}
                style={{ borderTop: i > 0 ? '1px solid var(--admin-rule-soft)' : 'none' }}
              >
                <Link
                  href={`/admin/tournaments/${t.id}`}
                  className="group grid items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/60 grid-cols-[minmax(0,1fr)_auto_16px] sm:grid-cols-[1fr_140px_130px_16px]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-foreground">{t.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                      <span className="admin-mono inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatRange(t.start_date, t.end_date)}
                      </span>
                      {t.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {t.location}
                        </span>
                      )}
                      <span className="admin-tab text-[11px] text-foreground/70 sm:hidden">
                        {formatLabel(t.format)}
                      </span>
                      {t.status === 'active' && t.format === 'round_robin_knockout' && (
                        <span className="admin-tab text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--admin-surface-2)', border: '1px solid var(--admin-rule)', color: 'var(--muted-foreground)' }}>
                          {t.knockout_qualifiers ? 'Knockout stage' : 'Group stage'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="admin-tab hidden text-right text-[11px] text-foreground/80 sm:block">
                    {formatLabel(t.format)}
                  </div>
                  <div className="flex justify-end">
                    <TournamentStatusBadge status={t.status} />
                  </div>
                  <ChevronRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    style={{ color: 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)' }}
                  />
                </Link>
              </li>
            ))}
          </ul>
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
      return 'Group → KO'
    default:
      return f
  }
}
