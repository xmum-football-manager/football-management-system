export interface GroupCompleteness {
  allAssigned: boolean
  allFull: boolean
  issues: string[]
}

/**
 * Returns structured completeness info for group assignment.
 * - allAssigned: every team has a valid group label (one of the first numGroups letters).
 * - allFull: every group has exactly teamsPerGroup teams.
 * - issues: human-readable blocking messages; empty means complete.
 */
export function groupCompleteness(
  teams: Array<{ id: string; name: string; group_label: string | null }>,
  numGroups: number,
  teamsPerGroup: number,
): GroupCompleteness {
  const validLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
  const issues: string[] = []

  // Part (a): find teams with null or out-of-range label
  const unassigned = teams.filter((t) => !t.group_label || !validLabels.includes(t.group_label))
  const allAssigned = unassigned.length === 0
  if (!allAssigned) {
    const shown = unassigned
      .slice(0, 3)
      .map((t) => t.name)
      .join(', ')
    const more = unassigned.length > 3 ? ` +${unassigned.length - 3} more` : ''
    issues.push(
      `${unassigned.length} team${unassigned.length === 1 ? '' : 's'} not assigned to a group: ${shown}${more}.`,
    )
  }

  // Part (b): check per-group counts
  const countByLabel = new Map<string, number>()
  for (const l of validLabels) countByLabel.set(l, 0)
  for (const t of teams) {
    if (t.group_label && validLabels.includes(t.group_label)) {
      countByLabel.set(t.group_label, (countByLabel.get(t.group_label) ?? 0) + 1)
    }
  }
  let allFull = true
  for (const label of validLabels) {
    const n = countByLabel.get(label) ?? 0
    if (n !== teamsPerGroup) {
      allFull = false
      issues.push(`Group ${label} has ${n} team${n === 1 ? '' : 's'}, expected ${teamsPerGroup}.`)
    }
  }

  return { allAssigned, allFull, issues }
}

/** Convenience wrapper — returns only the issues array. */
export function groupAssignmentIssues(
  teams: Array<{ id: string; name: string; group_label: string | null }>,
  numGroups: number,
  teamsPerGroup: number,
): string[] {
  return groupCompleteness(teams, numGroups, teamsPerGroup).issues
}
