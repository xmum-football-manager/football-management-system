import type { Standing } from '@/lib/supabase/types'

interface StandingsTableProps {
  standings: Standing[]
}

export function StandingsTable({ standings }: StandingsTableProps) {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return a.team_name.localeCompare(b.team_name)
  })

  if (sorted.length === 0) {
    return (
      <p className="text-slate-400 text-sm py-6 text-center">
        No matches played yet — standings will appear here once matches finish.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-400 text-xs font-semibold tracking-wide border-b border-slate-700">
            <th className="pb-2 text-left w-6">#</th>
            <th className="pb-2 text-left">Team</th>
            <th className="pb-2 text-right tabular-nums">MP</th>
            <th className="pb-2 text-right tabular-nums">W</th>
            <th className="pb-2 text-right tabular-nums">D</th>
            <th className="pb-2 text-right tabular-nums">L</th>
            <th className="pb-2 text-right tabular-nums">GS</th>
            <th className="pb-2 text-right tabular-nums">GC</th>
            <th className="pb-2 text-right tabular-nums">GD</th>
            <th className="pb-2 text-right tabular-nums font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.team_id}
              className={`border-b border-slate-800 ${i === 0 ? 'bg-green-950/30' : ''}`}
            >
              <td className="py-2 pr-2 text-slate-400 tabular-nums">{i + 1}</td>
              <td className="py-2 font-medium text-[15px]">{row.team_name}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">{row.matches_played}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">{row.wins}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">{row.draws}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">{row.losses}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">{row.goals_scored}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">{row.goals_conceded}</td>
              <td className="py-2 text-right tabular-nums text-slate-300">
                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
              </td>
              <td className="py-2 text-right tabular-nums font-bold">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
