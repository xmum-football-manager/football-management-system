import { describe, it, expect } from 'vitest'
import { computeGroupStandings } from '@/lib/qualifiers'

const team = (id: string, name: string, group_label: string) => ({ id, name, group_label })

const match = (
  homeId: string,
  awayId: string,
  hs: number,
  as_: number,
  status = 'finished',
) => ({
  status,
  home_team_id: homeId,
  away_team_id: awayId,
  home_score: hs,
  away_score: as_,
})

describe('computeGroupStandings', () => {
  it('awards 3 pts for a win, 0 for a loss', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 2, 0)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    const alpha = standings.find(s => s.teamId === 'a')!
    const beta = standings.find(s => s.teamId === 'b')!
    expect(alpha.points).toBe(3)
    expect(beta.points).toBe(0)
  })

  it('awards 1 pt each for a draw', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 1, 1)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 'b')!.points).toBe(1)
  })

  it('ignores non-finished matches', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 3, 0, 'live')]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.points).toBe(0)
  })

  it('computes goal difference correctly', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 3, 1)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.gd).toBe(2)
    expect(standings.find(s => s.teamId === 'b')!.gd).toBe(-2)
  })

  it('marks top advancePerGroup teams as qualified per group', () => {
    const teams = [
      team('a', 'Alpha', 'A'), team('b', 'Beta', 'A'), team('c', 'Gamma', 'A'),
    ]
    const matches = [
      match('a', 'b', 3, 0),
      match('a', 'c', 2, 0),
      match('b', 'c', 1, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 1, 2)
    expect(standings.find(s => s.teamId === 'a')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'b')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'c')!.qualified).toBe(false)
  })

  it('breaks ties by goal difference then alphabetical', () => {
    const teams = [
      team('a', 'Alpha', 'A'),
      team('b', 'Beta', 'A'),
      team('c', 'Gamma', 'A'),
    ]
    const matches = [
      match('a', 'c', 2, 0),
      match('b', 'c', 1, 0),
      match('a', 'b', 0, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'b')!.qualified).toBe(false)
  })

  it('handles multiple groups correctly', () => {
    const teams = [
      team('a', 'Alpha', 'A'), team('b', 'Beta', 'A'),
      team('c', 'Gamma', 'B'), team('d', 'Delta', 'B'),
    ]
    const matches = [
      match('a', 'b', 1, 0),
      match('c', 'd', 1, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 2, 1)
    const ids = standings.filter(s => s.qualified).map(s => s.teamId)
    expect(ids).toContain('a')
    expect(ids).toContain('c')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('d')
  })
})
