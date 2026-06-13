export interface TeamPlayerCount {
  id: string
  name: string
  playerCount: number
}

/**
 * Returns the subset of teams whose playerCount is strictly less than minPlayers.
 */
export function teamsShortOfMinPlayers(
  teams: TeamPlayerCount[],
  minPlayers: number,
): TeamPlayerCount[] {
  return teams.filter((t) => t.playerCount < minPlayers)
}

/**
 * Builds a human-readable error message listing teams that are short of the minimum.
 * e.g. "These teams need at least 11 players: Alpha A1 (3), Bravo B2 (7)."
 */
export function shortTeamsErrorMessage(
  shortTeams: TeamPlayerCount[],
  minPlayers: number,
): string {
  const list = shortTeams.map((t) => `${t.name} (${t.playerCount})`).join(', ')
  return `These teams need at least ${minPlayers} players: ${list}.`
}
