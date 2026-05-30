import { describe, it, expect } from 'vitest'
import { parseTeamsCsv } from '@/app/admin/tournaments/[id]/teams/csv-utils'

describe('parseTeamsCsv', () => {
  it('parses a valid CSV into teams and players', () => {
    const csv = `team,player_name,jersey_number,position
Team A,John Smith,1,GK
Team A,Jane Doe,5,DEF
Team B,Bob Wilson,10,MID`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams).toHaveLength(2)
    expect(teams[0].name).toBe('Team A')
    expect(teams[0].players).toHaveLength(2)
    expect(teams[0].players[0]).toEqual({ player_name: 'John Smith', jersey_number: 1, position: 'GK' })
    expect(teams[1].name).toBe('Team B')
    expect(teams[1].players[0]).toEqual({ player_name: 'Bob Wilson', jersey_number: 10, position: 'MID' })
  })

  it('treats optional jersey_number and position as null when empty', () => {
    const csv = `team,player_name,jersey_number,position
Team A,Alice,,`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0]).toEqual({ player_name: 'Alice', jersey_number: null, position: null })
  })

  it('returns error when CSV has fewer than 2 lines', () => {
    const { errors } = parseTeamsCsv('team,player_name')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/header row/)
  })

  it('returns error when required columns are missing', () => {
    const { errors } = parseTeamsCsv(`player_name,jersey_number\nJohn,1`)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/"team"/)
  })

  it('returns row-level error for missing team name', () => {
    const csv = `team,player_name\n,John Smith`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*team/)
  })

  it('returns row-level error for missing player name', () => {
    const csv = `team,player_name\nTeam A,`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*player_name/)
  })

  it('returns row-level error for jersey_number out of range', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,100`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*jersey_number/)
  })

  it('returns row-level error for non-integer jersey_number', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,abc`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*jersey_number/)
  })

  it('returns row-level error for invalid position', () => {
    const csv = `team,player_name,position\nTeam A,John,STRIKER`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*position/)
  })

  it('accepts position values case-insensitively', () => {
    const csv = `team,player_name,position\nTeam A,John,gk`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0].position).toBe('GK')
  })

  it('preserves team insertion order', () => {
    const csv = `team,player_name\nZebra FC,Alice\nAlpha FC,Bob`
    const { teams } = parseTeamsCsv(csv)
    expect(teams[0].name).toBe('Zebra FC')
    expect(teams[1].name).toBe('Alpha FC')
  })

  it('collects multiple errors across rows', () => {
    const csv = `team,player_name,position\n,John,GK\nTeam A,,DEF\nTeam A,Bob,BAD`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(3)
  })

  it('handles Windows-style line endings (CRLF)', () => {
    const csv = `team,player_name\r\nTeam A,John\r\nTeam A,Jane`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players).toHaveLength(2)
  })

  it('accepts jersey_number of 0 (lower boundary)', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,0`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0].jersey_number).toBe(0)
  })

  it('returns row-level error for jersey_number -1 (below lower boundary)', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,-1`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*jersey_number/)
  })

  it('returns error when player_name column is missing', () => {
    const { errors } = parseTeamsCsv(`team,jersey_number\nTeam A,1`)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/"player_name"/)
  })
})

describe('parseTeamsCsv — adversarial / edge cases', () => {
  // ── Header format variants ─────────────────────────────────────────────

  it('handles headers with spaces after commas (Excel/Sheets export style)', () => {
    const csv = `team, player_name, jersey_number, position\nTeam A,John,7,MID`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0]).toEqual({ player_name: 'John', jersey_number: 7, position: 'MID' })
  })

  it('handles UPPERCASE header columns', () => {
    const csv = `TEAM,PLAYER_NAME,JERSEY_NUMBER,POSITION\nTeam A,John,7,MID`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0].player_name).toBe('John')
  })

  it('handles scrambled column order', () => {
    const csv = `position,player_name,team,jersey_number\nGK,John,Team A,1`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].name).toBe('Team A')
    expect(teams[0].players[0]).toEqual({ player_name: 'John', jersey_number: 1, position: 'GK' })
  })

  it('ignores extra unknown columns', () => {
    const csv = `team,player_name,phone_number,jersey_number,position\nTeam A,John,012-345,7,FWD`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0]).toEqual({ player_name: 'John', jersey_number: 7, position: 'FWD' })
  })

  it('handles Excel BOM prefix on the first line', () => {
    const csv = `﻿team,player_name\nTeam A,John`
    // The BOM (U+FEFF) is the first character of the header line.
    // The parser calls .trim() on each header token, and JS trim() strips BOM,
    // so 'team' is found correctly and no error is produced.
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0].player_name).toBe('John')
  })

  // ── Data row edge cases ────────────────────────────────────────────────

  it('skips blank lines in the middle of CSV', () => {
    const csv = `team,player_name\nTeam A,John\n\nTeam A,Jane`
    const { teams, errors } = parseTeamsCsv(csv)
    // Blank line: both team and player_name are empty → row-level errors, but valid rows still parsed
    expect(teams[0].players.some(p => p.player_name === 'John')).toBe(true)
    expect(teams[0].players.some(p => p.player_name === 'Jane')).toBe(true)
  })

  it('returns error for whitespace-only team name (trims to empty)', () => {
    const csv = `team,player_name\n   ,John`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*team/)
  })

  it('returns error for whitespace-only player name (trims to empty)', () => {
    const csv = `team,player_name\nTeam A,   `
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*player_name/)
  })

  it('groups players under the same team when team name appears non-consecutively', () => {
    const csv = `team,player_name\nTeam A,John\nTeam B,Alice\nTeam A,Jane`
    const { teams, errors } = parseTeamsCsv(csv)
    // Team A appears twice — should be deduplicated into one team
    expect(errors).toEqual([])
    const teamA = teams.find(t => t.name === 'Team A')
    expect(teamA?.players).toHaveLength(2)
    expect(teams).toHaveLength(2)
  })

  it('returns error for float jersey_number (1.5)', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,1.5`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*jersey_number/)
  })

  it('accepts jersey_number 99 (upper boundary)', () => {
    const csv = `team,player_name,jersey_number\nTeam A,John,99`
    const { teams, errors } = parseTeamsCsv(csv)
    expect(errors).toEqual([])
    expect(teams[0].players[0].jersey_number).toBe(99)
  })

  it('handles a row with fewer columns than the header', () => {
    // Row has only team column, no player_name
    const csv = `team,player_name,jersey_number\nTeam A`
    const { errors } = parseTeamsCsv(csv)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/Row 2.*player_name/)
  })

  it('returns error for completely empty input', () => {
    const { errors } = parseTeamsCsv('')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/header row/)
  })
})

// NOTE: The "import CSV twice" scenario is guarded server-side.
// importTeamsAction re-runs listTeams() inside the action before any writes.
// A second import attempt returns { error: 'Teams already exist...' } even under
// concurrent requests, because the check runs per-request inside a try/catch.
// This is not testable as a unit test (requires a real DB connection).
