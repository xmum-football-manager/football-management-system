import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseTeamsCsv } from '@/app/admin/tournaments/[id]/teams/csv-utils'

const CSV_PATH = resolve(__dirname, 'fixtures/players.csv')
const csv = readFileSync(CSV_PATH, 'utf-8')

const EXPECTED_TEAMS = [
  'Team Alpha',
  'Team Beta',
  'Team Gamma',
  'Team Delta',
  'Team Epsilon',
  'Team Zeta',
  'Team Eta',
  'Team Theta',
]

describe('players.csv fixture import', () => {
  it('parses with no errors', () => {
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
  })

  it('produces exactly 8 teams', () => {
    const { teams } = parseTeamsCsv(csv)
    expect(teams).toHaveLength(8)
  })

  it('preserves team order from the file', () => {
    const { teams } = parseTeamsCsv(csv)
    expect(teams.map(t => t.name)).toEqual(EXPECTED_TEAMS)
  })

  it('gives every team exactly 11 players', () => {
    const { teams } = parseTeamsCsv(csv)
    for (const team of teams) {
      expect(team.players, `${team.name} should have 11 players`).toHaveLength(11)
    }
  })

  it('normalises full position names to abbreviations', () => {
    const { teams } = parseTeamsCsv(csv)
    const allPositions = teams.flatMap(t => t.players.map(p => p.position))
    // No full words should survive — all must be abbreviations
    expect(allPositions.every(p => ['GK', 'DEF', 'MID', 'FWD', null].includes(p))).toBe(true)
  })

  it('every team has exactly 1 GK, 4 DEF, 3 MID, 3 FWD', () => {
    const { teams } = parseTeamsCsv(csv)
    for (const team of teams) {
      const positions = team.players.map(p => p.position)
      expect(positions.filter(p => p === 'GK').length, `${team.name}: 1 GK`).toBe(1)
      expect(positions.filter(p => p === 'DEF').length, `${team.name}: 4 DEF`).toBe(4)
      expect(positions.filter(p => p === 'MID').length, `${team.name}: 3 MID`).toBe(3)
      expect(positions.filter(p => p === 'FWD').length, `${team.name}: 3 FWD`).toBe(3)
    }
  })

  it('jersey numbers run 1–11 per team', () => {
    const { teams } = parseTeamsCsv(csv)
    for (const team of teams) {
      const jerseys = team.players.map(p => p.jersey_number).sort((a, b) => (a ?? 0) - (b ?? 0))
      expect(jerseys, `${team.name}: jerseys 1-11`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    }
  })

  it('handles the apostrophe in "Patrick O\'Brien" without error', () => {
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    const delta = teams.find(t => t.name === 'Team Delta')!
    expect(delta.players.some(p => p.player_name === "Patrick O'Brien")).toBe(true)
  })

  it('handles multi-word names like "Mohammed Al-Farsi" correctly', () => {
    const { teams } = parseTeamsCsv(csv)
    const zeta = teams.find(t => t.name === 'Team Zeta')!
    expect(zeta.players.some(p => p.player_name === 'Mohammed Al-Farsi')).toBe(true)
  })

  it('total player count across all teams is 88', () => {
    const { teams } = parseTeamsCsv(csv)
    const total = teams.reduce((sum, t) => sum + t.players.length, 0)
    expect(total).toBe(88)
  })
})
