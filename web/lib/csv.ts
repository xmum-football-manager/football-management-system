export interface CsvRow {
  team: string
  player_name: string
  position: string | null
  jersey_number: number | null
}

export interface ParseResult {
  rows: CsvRow[]
  errors: string[]
}

export function parseTeamsCsv(csv: string): ParseResult {
  const errors: string[] = []
  const rows: CsvRow[] = []

  const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return { rows, errors }

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const teamIdx = header.indexOf('team')
  const playerIdx = header.indexOf('player_name')
  const posIdx = header.indexOf('position')
  const numIdx = header.indexOf('jersey_number')

  const missing: string[] = []
  if (teamIdx === -1) missing.push('team')
  if (playerIdx === -1) missing.push('player_name')
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`)
    return { rows, errors }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(',').map((c) => c.trim())

    const team = cols[teamIdx] ?? ''
    const player_name = cols[playerIdx] ?? ''

    if (!team || !player_name) {
      errors.push(`Row ${i + 1}: missing team or player_name — skipped`)
      continue
    }

    const rawNum = numIdx >= 0 ? cols[numIdx] : ''
    let jersey_number: number | null = null
    if (rawNum) {
      const n = Number(rawNum)
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        errors.push(`Row ${i + 1}: jersey_number "${rawNum}" must be 0–99 — skipped`)
        continue
      }
      jersey_number = n
    }

    const position = posIdx >= 0 && cols[posIdx] ? cols[posIdx] : null

    rows.push({ team, player_name, position, jersey_number })
  }

  return { rows, errors }
}
