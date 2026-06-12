/**
 * Validates that a first-round knockout pairing can be edited.
 * Rules (first failing rule wins):
 *  - phase must be 'knockout'
 *  - status must be 'scheduled'
 *  - must be first round (both source match ids null)
 *  - homeId must differ from awayId
 *  - both homeId and awayId must be in qualifierIds
 *  - neither homeId nor awayId may appear in occupiedByOthers (team ids
 *    already assigned to other first-round matches)
 */
export function validatePairingEdit(
  match: {
    phase: string | null
    status: string
    home_source_match_id: string | null
    away_source_match_id: string | null
  },
  homeId: string,
  awayId: string,
  qualifierIds: string[],
  occupiedByOthers: string[],
): { ok: true } | { error: string } {
  if (match.phase !== 'knockout') return { error: 'Match is not a knockout match.' }
  if (match.status !== 'scheduled') return { error: 'Only scheduled matches can be edited.' }
  if (match.home_source_match_id !== null || match.away_source_match_id !== null) {
    return { error: 'Only first-round matches (with no source matches) can be edited.' }
  }
  if (homeId === awayId) return { error: 'Home and away teams must be different.' }
  if (!qualifierIds.includes(homeId)) return { error: 'Home team is not in the qualifier pool.' }
  if (!qualifierIds.includes(awayId)) return { error: 'Away team is not in the qualifier pool.' }
  if (occupiedByOthers.includes(homeId) || occupiedByOthers.includes(awayId)) {
    return { error: 'That team is already in another first-round match.' }
  }
  return { ok: true }
}

/**
 * Returns the required number of qualifiers for the given knockout_start_round
 * value. Returns null for null or unknown values (legacy tournaments — no
 * constraint to enforce).
 */
export function expectedBracketSize(round: string | null): number | null {
  switch (round) {
    case 'final':  return 2
    case 'semi':   return 4
    case 'top_8':  return 8
    case 'top_16': return 16
    case 'top_32': return 32
    default:       return null
  }
}

/**
 * Returns true only if there is at least one group-stage match and every
 * group-stage match has status 'finished'. Knockout matches are ignored.
 */
export function groupStageComplete(
  matches: Array<{ phase: string | null; status: string }>,
): boolean {
  const groupMatches = matches.filter((m) => m.phase === 'group')
  if (groupMatches.length === 0) return false
  return groupMatches.every((m) => m.status === 'finished')
}

export interface TeamStanding {
  teamId: string
  teamName: string
  groupLabel: string
  points: number
  gd: number
  qualified: boolean
}

export interface BoundaryTie {
  groupLabel: string
  /** How many of the contested teams will actually qualify. */
  slots: number
  /** Teams level on points AND goal difference straddling the cutoff. */
  contestedTeamIds: string[]
}

/** Internal: compute guaranteed qualifiers, contested teams, and remaining slots for one group. */
function _groupBoundary(
  group: TeamStanding[],
  advancePerGroup: number,
): { guaranteed: TeamStanding[]; contested: TeamStanding[]; slots: number } {
  const sorted = [...group].sort(
    (a, b) => (b.points !== a.points ? b.points - a.points : b.gd - a.gd),
  )
  const cutoff = sorted[advancePerGroup - 1]
  if (!cutoff) return { guaranteed: [], contested: [], slots: 0 }

  const guaranteed = sorted.filter(
    (s) => s.points > cutoff.points || (s.points === cutoff.points && s.gd > cutoff.gd),
  )
  const contested = sorted.filter(
    (s) => s.points === cutoff.points && s.gd === cutoff.gd,
  )
  const slots = advancePerGroup - guaranteed.length
  return { guaranteed, contested, slots }
}

/**
 * Finds groups where the qualification cutoff falls inside a set of teams that
 * are level on points AND goal difference — the case otherwise decided silently
 * by alphabetical order. The organizer must pick which contested teams advance.
 */
export function detectBoundaryTies(
  standings: TeamStanding[],
  advancePerGroup: number,
): BoundaryTie[] {
  const labels = [...new Set(standings.map((s) => s.groupLabel))]
  const ties: BoundaryTie[] = []

  for (const label of labels) {
    const group = standings.filter((s) => s.groupLabel === label)
    const { guaranteed, contested, slots } = _groupBoundary(group, advancePerGroup)
    if (contested.length > slots) {
      ties.push({ groupLabel: label, slots, contestedTeamIds: contested.map((s) => s.teamId) })
    }
  }

  return ties
}

/**
 * Validates an admin's qualifier selection against per-group rules:
 *  a. Each group must have EXACTLY advancePerGroup selected teams.
 *  b. Every "guaranteed" team (strictly above cutoff) must be selected.
 *  c. No team strictly below the contested tie-level may be selected.
 */
export function validateQualifierSelection(
  standings: TeamStanding[],
  selectedIds: string[],
  advancePerGroup: number,
  numGroups: number,
): { ok: true } | { error: string } {
  const labels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const selected = new Set(selectedIds)

  for (const label of labels) {
    const group = standings.filter((s) => s.groupLabel === label)
    const groupSelected = group.filter((s) => selected.has(s.teamId))

    if (groupSelected.length !== advancePerGroup) {
      return { error: `Group ${label} must have exactly ${advancePerGroup} qualifier(s) selected (currently ${groupSelected.length}).` }
    }

    const { guaranteed, contested } = _groupBoundary(group, advancePerGroup)
    const guaranteedIds = new Set(guaranteed.map((s) => s.teamId))
    const contestedIds = new Set(contested.map((s) => s.teamId))

    for (const s of guaranteed) {
      if (!selected.has(s.teamId)) {
        return { error: `${s.teamName} (Group ${label}) is a guaranteed qualifier and must be selected.` }
      }
    }

    for (const s of groupSelected) {
      if (!guaranteedIds.has(s.teamId) && !contestedIds.has(s.teamId)) {
        return { error: `${s.teamName} (Group ${label}) is eliminated and cannot be selected.` }
      }
    }
  }

  return { ok: true }
}

/**
 * Computes group-stage standings and marks qualifiers per group.
 * Constraints: numGroups must be ≤ 26 (A–Z labels), advancePerGroup must be ≥ 1.
 */
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
    const homeScore = m.home_score
    const awayScore = m.away_score
    if (homeScore > awayScore) { home.points += 3 }
    else if (homeScore < awayScore) { away.points += 3 }
    else { home.points += 1; away.points += 1 }
    home.gd += homeScore - awayScore
    away.gd += awayScore - homeScore
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
