import { describe, it, expect } from 'vitest'
import { computeAutoWinner } from '@/app/admin/tournaments/[id]/advance'

describe('computeAutoWinner', () => {
  it('returns the home team when home outscores away', () => {
    expect(computeAutoWinner({ home_team_id: 'h', away_team_id: 'a', home_score: 2, away_score: 1 })).toBe('h')
  })
  it('returns the away team when away outscores home', () => {
    expect(computeAutoWinner({ home_team_id: 'h', away_team_id: 'a', home_score: 0, away_score: 3 })).toBe('a')
  })
  it('returns null on a draw (admin must pick)', () => {
    expect(computeAutoWinner({ home_team_id: 'h', away_team_id: 'a', home_score: 1, away_score: 1 })).toBeNull()
  })
  it('returns null when a team slot is unfilled', () => {
    expect(computeAutoWinner({ home_team_id: null, away_team_id: 'a', home_score: 0, away_score: 0 })).toBeNull()
  })
})
