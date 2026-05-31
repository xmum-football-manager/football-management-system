export interface TeamStanding {
  teamId: string
  teamName: string
  groupLabel: string
  points: number
  gd: number
  qualified: boolean
}

export function computeGroupStandings(
  teams: Array<{ id: string; name: string; group_label: string | null }>,
  matches: Array<{
    status: string
    home_team_id: string
    away_team_id: string
    home_score: number
    away_score: number
  }>,
  numGroups: number,
  advancePerGroup: number,
): TeamStanding[] {
  const labels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

  const map = new Map<string, { points: number; gd: number; name: string; groupLabel: string }>()
  for (const t of teams) {
    if (t.group_label && labels.includes(t.group_label)) {
      map.set(t.id, { points: 0, gd: 0, name: t.name, groupLabel: t.group_label })
    }
  }

  for (const m of matches) {
    if (m.status !== 'finished') continue
    const home = map.get(m.home_team_id)
    const away = map.get(m.away_team_id)
    if (!home || !away) continue
    const h = m.home_score
    const a = m.away_score
    if (h > a) { home.points += 3 }
    else if (h < a) { away.points += 3 }
    else { home.points += 1; away.points += 1 }
    home.gd += h - a
    away.gd += a - h
  }

  const qualifiedIds = new Set<string>()
  for (const label of labels) {
    const groupEntries = [...map.entries()]
      .filter(([, s]) => s.groupLabel === label)
      .sort(([, a], [, b]) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.gd !== a.gd) return b.gd - a.gd
        return a.name.localeCompare(b.name)
      })
    groupEntries.slice(0, advancePerGroup).forEach(([id]) => qualifiedIds.add(id))
  }

  return [...map.entries()].map(([teamId, s]) => ({
    teamId,
    teamName: s.name,
    groupLabel: s.groupLabel,
    points: s.points,
    gd: s.gd,
    qualified: qualifiedIds.has(teamId),
  }))
}
