import { describe, it, expect } from 'vitest'
import { parseTeamsCsv } from '@/lib/csv'

describe('parseTeamsCsv', () => {
  it('parses a well-formed CSV into rows', () => {
    const csv = `team,player_name,position,jersey_number
Lions,John Smith,FWD,9
Lions,Mike Lee,GK,1`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]).toEqual({ team: 'Lions', player_name: 'John Smith', position: 'FWD', jersey_number: 9 })
    expect(result.rows[1]).toEqual({ team: 'Lions', player_name: 'Mike Lee', position: 'GK', jersey_number: 1 })
    expect(result.errors).toHaveLength(0)
  })

  it('handles optional position and jersey_number', () => {
    const csv = `team,player_name,position,jersey_number
Tigers,Amy Chen,,`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toEqual({ team: 'Tigers', player_name: 'Amy Chen', position: null, jersey_number: null })
  })

  it('returns an error for missing required columns in header', () => {
    const csv = `team,name\nLions,John`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors).toContain('Missing required columns: player_name')
  })

  it('skips rows with empty team or player_name and reports them', () => {
    const csv = `team,player_name,position,jersey_number
,John Smith,FWD,9
Lions,,GK,1
Lions,Valid Player,,`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toHaveLength(2)
  })

  it('rejects jersey_number outside 0-99', () => {
    const csv = `team,player_name,position,jersey_number
Lions,John Smith,FWD,150`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(0)
    expect(result.errors[0]).toContain('jersey_number')
  })

  it('handles Windows CRLF line endings', () => {
    const csv = `team,player_name,position,jersey_number\r\nLions,John Smith,FWD,9\r\n`
    const result = parseTeamsCsv(csv)
    expect(result.rows).toHaveLength(1)
  })
})
