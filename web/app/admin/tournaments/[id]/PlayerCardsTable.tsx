import type { PlayerCardCount } from '@/lib/supabase/types'

/**
 * Tournament-wide disciplinary record: each player's total yellow and red
 * cards across every match. Rendered on the admin overview below the match
 * list / bracket. Already sorted (reds, then yellows, then name).
 */
export function PlayerCardsTable({ rows }: { rows: PlayerCardCount[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="admin-eyebrow">Disciplinary</p>
        <span className="admin-mono text-[11px] text-muted-foreground">
          {rows.reduce((n, r) => n + r.yellow, 0)} yellow ·{' '}
          {rows.reduce((n, r) => n + r.red, 0)} red
        </span>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-xl border bg-card p-6 text-sm text-muted-foreground"
          style={{ borderColor: 'var(--admin-rule)' }}
        >
          No cards recorded yet.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-xl border bg-card"
          style={{ borderColor: 'var(--admin-rule)' }}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Player</Th>
                <Th>Team</Th>
                <Th align="right">Yellow</Th>
                <Th align="right">Red</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.player_id}
                  style={{
                    borderTop: i === 0 ? undefined : '1px solid var(--admin-rule)',
                  }}
                >
                  <td className="px-4 py-2.5 text-sm font-medium">{r.player_name}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.team_name}</td>
                  <td className="px-4 py-2.5 text-right">
                    <CardPill count={r.yellow} color="#EAB308" />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <CardPill count={r.red} color="#DC2626" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className="admin-eyebrow px-4 py-2.5"
      style={{
        textAlign: align,
        borderBottom: '1px solid var(--admin-rule)',
        color: 'var(--muted-foreground)',
      }}
    >
      {children}
    </th>
  )
}

function CardPill({ count, color }: { count: number; color: string }) {
  if (count === 0) {
    return <span className="admin-mono text-sm text-muted-foreground">—</span>
  }
  return (
    <span className="admin-mono inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
      <span
        className="inline-block h-3 w-[9px] rounded-[1.5px]"
        style={{ background: color }}
      />
      {count}
    </span>
  )
}
