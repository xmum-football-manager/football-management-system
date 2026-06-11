export interface ParsedPlayer {
  player_name: string
  jersey_number: number | null
}

export interface ParsedTeam {
  name: string
  players: ParsedPlayer[]
}

export interface ParseResult {
  teams: ParsedTeam[]
  errors: string[]
}

export function parseTeamsCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split(/\r?\n/)
  const errors: string[] = []

  if (lines.length < 2) {
    return { teams: [], errors: ['CSV must have a header row and at least one data row.'] }
  }

  const header = lines[0].trim().toLowerCase().split(',').map(h => h.trim())
  const teamIdx = header.indexOf('team')
  const playerIdx = header.indexOf('player_name')
  const jerseyIdx = header.indexOf('jersey_number')

  if (teamIdx === -1 || playerIdx === -1) {
    return { teams: [], errors: ['CSV must have "team" and "player_name" columns.'] }
  }

  const teamMap = new Map<string, ParsedPlayer[]>()
  const teamOrder: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const row = i + 1
    // Simple split — does not handle quoted fields containing commas (RFC 4180)
    const cols = lines[i].split(',')

    const teamName = cols[teamIdx]?.trim() ?? ''
    const playerName = cols[playerIdx]?.trim() ?? ''
    const jerseyRaw = jerseyIdx !== -1 ? (cols[jerseyIdx]?.trim() ?? '') : ''

    if (!teamName) { errors.push(`Row ${row}: "team" is required.`); continue }
    if (!playerName) { errors.push(`Row ${row}: "player_name" is required.`); continue }

    let jerseyNumber: number | null = null
    if (jerseyRaw !== '') {
      const n = Number(jerseyRaw)
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        errors.push(`Row ${row}: jersey_number must be an integer 0–99.`)
        continue
      }
      jerseyNumber = n
    }

    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, [])
      teamOrder.push(teamName)
    }
    teamMap.get(teamName)!.push({ player_name: playerName, jersey_number: jerseyNumber })
  }

  const teams = teamOrder.map((name) => ({ name, players: teamMap.get(name)! }))
  return { teams, errors }
}
