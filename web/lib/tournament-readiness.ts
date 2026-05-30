import type { TournamentFormat, Team } from '@/lib/supabase/types'

export interface TournamentReadiness {
  totalTeams: number
  teamsWithEnoughPlayers: number
  allPlayersReady: boolean
  allGroupsAssigned: boolean
  allGroupsFull: boolean
  canGenerateFixtures: boolean
  blockingIssues: string[]
}

export function checkTournamentReadiness(
  teams: Pick<Team, 'id' | 'name' | 'group_label'>[],
  playerCounts: Record<string, number>,
  minPlayersPerTeam: number,
  format: TournamentFormat,
  numGroups: number | null,
  teamsPerGroup: number | null,
): TournamentReadiness {
  const totalTeams = teams.length
  let teamsWithEnoughPlayers = 0
  const teamsWithoutPlayers: string[] = []

  for (const t of teams) {
    const count = playerCounts[t.id] ?? 0
    if (count >= minPlayersPerTeam) {
      teamsWithEnoughPlayers++
    } else {
      teamsWithoutPlayers.push(t.name)
    }
  }

  const allPlayersReady = teamsWithoutPlayers.length === 0

  const isGroupFormat = format === 'round_robin_knockout'
  let allGroupsAssigned = true
  let allGroupsFull = true
  const unassignedTeams: string[] = []
  const groupIssues: string[] = []

  if (isGroupFormat && numGroups != null) {
    const validLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))

    // Check every team has a valid label
    for (const t of teams) {
      if (!t.group_label || !validLabels.includes(t.group_label)) {
        allGroupsAssigned = false
        unassignedTeams.push(t.name)
      }
    }

    // Check per-group counts when teamsPerGroup is set
    if (teamsPerGroup != null) {
      const countByLabel = new Map<string, number>()
      for (const l of validLabels) countByLabel.set(l, 0)
      for (const t of teams) {
        if (t.group_label && validLabels.includes(t.group_label)) {
          countByLabel.set(t.group_label, (countByLabel.get(t.group_label) ?? 0) + 1)
        }
      }
      for (const label of validLabels) {
        const n = countByLabel.get(label) ?? 0
        if (n !== teamsPerGroup) {
          allGroupsFull = false
          groupIssues.push(`Group ${label} has ${n} team${n === 1 ? '' : 's'}, expected ${teamsPerGroup}.`)
        }
      }
    }
  }

  const blockingIssues: string[] = []
  if (!allPlayersReady) {
    const shown = teamsWithoutPlayers.slice(0, 3).join(', ')
    const more = teamsWithoutPlayers.length > 3 ? ` +${teamsWithoutPlayers.length - 3} more` : ''
    blockingIssues.push(
      `${teamsWithoutPlayers.length} team${teamsWithoutPlayers.length === 1 ? '' : 's'} need at least ${minPlayersPerTeam} players: ${shown}${more}.`
    )
  }
  if (!allGroupsAssigned) {
    const shown = unassignedTeams.slice(0, 3).join(', ')
    const more = unassignedTeams.length > 3 ? ` +${unassignedTeams.length - 3} more` : ''
    blockingIssues.push(
      `${unassignedTeams.length} team${unassignedTeams.length === 1 ? '' : 's'} not assigned to a group: ${shown}${more}.`
    )
  }
  blockingIssues.push(...groupIssues)

  return {
    totalTeams,
    teamsWithEnoughPlayers,
    allPlayersReady,
    allGroupsAssigned,
    allGroupsFull,
    canGenerateFixtures: allPlayersReady && allGroupsAssigned && allGroupsFull,
    blockingIssues,
  }
}
