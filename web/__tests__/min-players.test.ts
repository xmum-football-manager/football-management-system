import { describe, it, expect } from 'vitest'
import { teamsShortOfMinPlayers } from '@/lib/min-players'

const team = (id: string, name: string, playerCount: number) => ({ id, name, playerCount })

describe('teamsShortOfMinPlayers', () => {
  it('returns empty array when all teams meet the minimum', () => {
    const teams = [team('1', 'Alpha', 11), team('2', 'Bravo', 15)]
    expect(teamsShortOfMinPlayers(teams, 11)).toEqual([])
  })

  it('returns only the short teams', () => {
    const teams = [team('1', 'Alpha', 3), team('2', 'Bravo', 11), team('3', 'Charlie', 7)]
    const result = teamsShortOfMinPlayers(teams, 11)
    expect(result).toHaveLength(2)
    expect(result.map((t) => t.id)).toEqual(['1', '3'])
  })

  it('does not flag a team with exactly the minimum', () => {
    const teams = [team('1', 'Alpha', 11)]
    expect(teamsShortOfMinPlayers(teams, 11)).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(teamsShortOfMinPlayers([], 11)).toEqual([])
  })
})
