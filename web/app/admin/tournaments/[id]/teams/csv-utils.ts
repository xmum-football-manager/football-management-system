export interface ParsedPlayer {
  player_name: string
  jersey_number: number | null
  position: string | null
}

export interface ParsedTeam {
  name: string
  players: ParsedPlayer[]
}

export interface ParseResult {
  teams: ParsedTeam[]
  errors: string[]
}

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD'])

export function parseTeamsCsv(csvText: string): ParseResult {
  const lines = csvText.trim().split(/\r?\n/)
  const errors: string[] = []

  if (lines.length < 2) {
    return { teams: [], errors: ['CSV must have a header row and at least one data row.'] }
  }

  const header = lines[0].trim().toLowerCase().split(',')
  const teamIdx = header.indexOf('team')
  const playerIdx = header.indexOf('player_name')
  const jerseyIdx = header.indexOf('jersey_number')
  const posIdx = header.indexOf('position')

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
    const posRaw = posIdx !== -1 ? (cols[posIdx]?.trim().toUpperCase() ?? '') : ''

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

    let position: string | null = null
    if (posRaw !== '') {
      if (!VALID_POSITIONS.has(posRaw)) {
        errors.push(`Row ${row}: position must be one of GK, DEF, MID, FWD.`)
        continue
      }
      position = posRaw
    }

    if (!teamMap.has(teamName)) {
      teamMap.set(teamName, [])
      teamOrder.push(teamName)
    }
    teamMap.get(teamName)!.push({ player_name: playerName, jersey_number: jerseyNumber, position })
  }

  const teams = teamOrder.map((name) => ({ name, players: teamMap.get(name)! }))
  return { teams, errors }
}
