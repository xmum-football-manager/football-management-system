import type { TournamentFormat, Team } from '@/lib/supabase/types'
import { groupCompleteness } from '@/lib/groups-complete'

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
  let groupIssuesFromHelper: string[] = []

  if (isGroupFormat && numGroups != null && teamsPerGroup != null) {
    const gc = groupCompleteness(teams, numGroups, teamsPerGroup)
    allGroupsAssigned = gc.allAssigned
    allGroupsFull = gc.allFull
    groupIssuesFromHelper = gc.issues
  }

  const blockingIssues: string[] = []
  if (!allPlayersReady) {
    const shown = teamsWithoutPlayers.slice(0, 3).join(', ')
    const more = teamsWithoutPlayers.length > 3 ? ` +${teamsWithoutPlayers.length - 3} more` : ''
    blockingIssues.push(
      `${teamsWithoutPlayers.length} team${teamsWithoutPlayers.length === 1 ? '' : 's'} need at least ${minPlayersPerTeam} players: ${shown}${more}.`
    )
  }
  blockingIssues.push(...groupIssuesFromHelper)

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
