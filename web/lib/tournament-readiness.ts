import type { TournamentFormat, Team } from '@/lib/supabase/types'

export interface TournamentReadiness {
  /** Total number of teams in the tournament */
  totalTeams: number
  /** Number of teams that have enough players */
  teamsWithEnoughPlayers: number
  /** True when every team has >= minPlayersPerTeam players */
  allPlayersReady: boolean
  /** For group formats: true when every team has a valid group_label */
  allGroupsAssigned: boolean
  /** Overall: fixtures can be generated */
  canGenerateFixtures: boolean
  /** Human-readable issues blocking fixture generation */
  blockingIssues: string[]
}

export function checkTournamentReadiness(
  teams: Pick<Team, 'id' | 'name' | 'group_label'>[],
  playerCounts: Record<string, number>,
  minPlayersPerTeam: number,
  format: TournamentFormat,
  numGroups: number | null,
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

  // Group assignment check (only for group formats)
  const isGroupFormat = format === 'round_robin_knockout'
  let allGroupsAssigned = true
  const unassignedTeams: string[] = []

  if (isGroupFormat && numGroups != null) {
    const validLabels = Array.from({ length: numGroups }, (_, i) => String.fromCharCode(65 + i))
    for (const t of teams) {
      if (!t.group_label || !validLabels.includes(t.group_label)) {
        allGroupsAssigned = false
        unassignedTeams.push(t.name)
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

  return {
    totalTeams,
    teamsWithEnoughPlayers,
    allPlayersReady,
    allGroupsAssigned,
    canGenerateFixtures: allPlayersReady && allGroupsAssigned,
    blockingIssues,
  }
}
