import { describe, it, expect } from 'vitest'
import type { Standing, MatchWithTeams } from '@/lib/supabase/types'

// Extracted from StandingsTable.tsx
function deriveMatchdayProgress(matches: MatchWithTeams[] = []) {
  if (matches.length === 0) return { played: 0, total: 0 }
  const total = matches.length
  const played = matches.filter(m => m.status === 'finished').length
  return { played, total }
}

function sortStandings(standings: Standing[]) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    return a.team_name.localeCompare(b.team_name)
  })
}

describe('deriveMatchdayProgress', () => {
  it('returns zeros for empty matches', () => {
    expect(deriveMatchdayProgress([])).toEqual({ played: 0, total: 0 })
  })

  it('returns zeros when no matches passed', () => {
    expect(deriveMatchdayProgress()).toEqual({ played: 0, total: 0 })
  })

  it('counts finished matches as played', () => {
    const matches = [
      { status: 'finished' },
      { status: 'live' },
      { status: 'scheduled' },
      { status: 'finished' },
    ] as MatchWithTeams[]
    expect(deriveMatchdayProgress(matches)).toEqual({ played: 2, total: 4 })
  })

  it('counts all finished when all matches done', () => {
    const matches = [
      { status: 'finished' },
      { status: 'finished' },
    ] as MatchWithTeams[]
    expect(deriveMatchdayProgress(matches)).toEqual({ played: 2, total: 2 })
  })

  it('counts zero played when all scheduled', () => {
    const matches = [
      { status: 'scheduled' },
      { status: 'scheduled' },
    ] as MatchWithTeams[]
    expect(deriveMatchdayProgress(matches)).toEqual({ played: 0, total: 2 })
  })

  it('includes halftime matches as not played', () => {
    const matches = [
      { status: 'halftime' },
      { status: 'live' },
    ] as MatchWithTeams[]
    expect(deriveMatchdayProgress(matches)).toEqual({ played: 0, total: 2 })
  })
})

describe('sortStandings', () => {
  it('sorts by points descending', () => {
    const standings = [
      { team_name: 'Team A', points: 3, goal_difference: 0 },
      { team_name: 'Team B', points: 9, goal_difference: 0 },
      { team_name: 'Team C', points: 6, goal_difference: 0 },
    ] as Standing[]
    const sorted = sortStandings(standings)
    expect(sorted[0].team_name).toBe('Team B')
    expect(sorted[1].team_name).toBe('Team C')
    expect(sorted[2].team_name).toBe('Team A')
  })

  it('sorts by goal_difference when points are tied', () => {
    const standings = [
      { team_name: 'Team A', points: 6, goal_difference: 1 },
      { team_name: 'Team B', points: 6, goal_difference: 5 },
    ] as Standing[]
    const sorted = sortStandings(standings)
    expect(sorted[0].team_name).toBe('Team B')
    expect(sorted[1].team_name).toBe('Team A')
  })

  it('sorts alphabetically when points and goal_difference are tied', () => {
    const standings = [
      { team_name: 'Zebra FC', points: 6, goal_difference: 3 },
      { team_name: 'Alpha FC', points: 6, goal_difference: 3 },
    ] as Standing[]
    const sorted = sortStandings(standings)
    expect(sorted[0].team_name).toBe('Alpha FC')
    expect(sorted[1].team_name).toBe('Zebra FC')
  })

  it('does not mutate original array', () => {
    const standings = [
      { team_name: 'Team A', points: 3, goal_difference: 0 },
      { team_name: 'Team B', points: 9, goal_difference: 0 },
    ] as Standing[]
    const sorted = sortStandings(standings)
    expect(standings[0].team_name).toBe('Team A') // original unchanged
    expect(sorted[0].team_name).toBe('Team B')
  })

  it('handles single team', () => {
    const standings = [{ team_name: 'Solo FC', points: 0, goal_difference: 0 }] as Standing[]
    const sorted = sortStandings(standings)
    expect(sorted).toHaveLength(1)
    expect(sorted[0].team_name).toBe('Solo FC')
  })

  it('handles empty array', () => {
    expect(sortStandings([])).toEqual([])
  })
})
