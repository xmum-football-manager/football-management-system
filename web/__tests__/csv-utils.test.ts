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
