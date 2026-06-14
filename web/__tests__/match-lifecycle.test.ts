import { describe, it, expect } from 'vitest'
import { isValidTransition, getAvailableTransitions, canScorekeeper, shouldClearKnockoutWinner, knockoutWinnerTeamId } from '@/lib/match-lifecycle'

describe('isValidTransition — organizer', () => {
  it('allows scheduled → live', () => {
    expect(isValidTransition('scheduled', 'live', 'organizer')).toBe(true)
  })
  it('allows live → halftime', () => {
    expect(isValidTransition('live', 'halftime', 'organizer')).toBe(true)
  })
  it('allows halftime → live', () => {
    expect(isValidTransition('halftime', 'live', 'organizer')).toBe(true)
  })
  it('allows live → finished', () => {
    expect(isValidTransition('live', 'finished', 'organizer')).toBe(true)
  })
})

describe('isValidTransition — organizer cannot revert', () => {
  it('rejects finished → live for organizer', () => {
    expect(isValidTransition('finished', 'live', 'organizer')).toBe(false)
  })
})

describe('isValidTransition — admin revert', () => {
  it('allows finished → live for admin', () => {
    expect(isValidTransition('finished', 'live', 'admin')).toBe(true)
  })
  it('allows scheduled → live for admin', () => {
    expect(isValidTransition('scheduled', 'live', 'admin')).toBe(true)
  })
})

describe('isValidTransition — illegal jumps', () => {
  it('rejects scheduled → finished', () => {
    expect(isValidTransition('scheduled', 'finished', 'organizer')).toBe(false)
  })
  it('rejects scheduled → halftime', () => {
    expect(isValidTransition('scheduled', 'halftime', 'organizer')).toBe(false)
  })
  it('rejects halftime → finished', () => {
    expect(isValidTransition('halftime', 'finished', 'organizer')).toBe(false)
  })
  it('rejects finished → halftime', () => {
    expect(isValidTransition('finished', 'halftime', 'organizer')).toBe(false)
  })
  it('rejects live → scheduled', () => {
    expect(isValidTransition('live', 'scheduled', 'organizer')).toBe(false)
  })
})

describe('getAvailableTransitions', () => {
  it('organizer on scheduled gets only Kickoff', () => {
    const t = getAvailableTransitions('scheduled', 'organizer')
    expect(t).toHaveLength(1)
    expect(t[0]).toEqual({ action: 'Kickoff', nextStatus: 'live' })
  })
  it('organizer on live gets Half Time and Full Time', () => {
    const t = getAvailableTransitions('live', 'organizer')
    expect(t).toHaveLength(2)
    expect(t.map(x => x.action)).toContain('Half Time')
    expect(t.map(x => x.action)).toContain('Full Time')
  })
  it('organizer on halftime gets only Start 2nd Half', () => {
    const t = getAvailableTransitions('halftime', 'organizer')
    expect(t).toHaveLength(1)
    expect(t[0]).toEqual({ action: 'Start 2nd Half', nextStatus: 'live' })
  })
  it('organizer on finished gets no transitions', () => {
    expect(getAvailableTransitions('finished', 'organizer')).toHaveLength(0)
  })
  it('admin on finished gets Revert to Live', () => {
    const t = getAvailableTransitions('finished', 'admin')
    expect(t).toHaveLength(1)
    expect(t[0]).toEqual({ action: 'Revert to Live', nextStatus: 'live' })
  })
})

describe('canScorekeeper', () => {
  it('enabled when live', () => { expect(canScorekeeper('live')).toBe(true) })
  it('disabled when scheduled', () => { expect(canScorekeeper('scheduled')).toBe(false) })
  it('disabled when halftime', () => { expect(canScorekeeper('halftime')).toBe(false) })
  it('disabled when finished', () => { expect(canScorekeeper('finished')).toBe(false) })
})

describe('shouldClearKnockoutWinner', () => {
  it('knockout finished→live returns true', () => {
    expect(shouldClearKnockoutWinner({ phase: 'knockout', from: 'finished', to: 'live' })).toBe(true)
  })
  it('knockout finished→halftime returns true', () => {
    expect(shouldClearKnockoutWinner({ phase: 'knockout', from: 'finished', to: 'halftime' })).toBe(true)
  })
  it('group finished→live returns false', () => {
    expect(shouldClearKnockoutWinner({ phase: 'group', from: 'finished', to: 'live' })).toBe(false)
  })
  it('knockout live→finished returns false', () => {
    expect(shouldClearKnockoutWinner({ phase: 'knockout', from: 'live', to: 'finished' })).toBe(false)
  })
  it('knockout scheduled→live returns false', () => {
    expect(shouldClearKnockoutWinner({ phase: 'knockout', from: 'scheduled', to: 'live' })).toBe(false)
  })
})

describe('knockoutWinnerTeamId', () => {
  const base = { status: 'finished' as const, winner_team_id: null, home_team_id: 'home', away_team_id: 'away', home_score: 0, away_score: 0 }

  it('returns null until finished', () => {
    expect(knockoutWinnerTeamId({ ...base, status: 'live', home_score: 2, away_score: 1 })).toBeNull()
  })
  it('uses winner_team_id when set (admin-decided tie)', () => {
    expect(knockoutWinnerTeamId({ ...base, winner_team_id: 'away', home_score: 1, away_score: 1 })).toBe('away')
  })
  it('winner_team_id overrides the score', () => {
    expect(knockoutWinnerTeamId({ ...base, winner_team_id: 'away', home_score: 3, away_score: 1 })).toBe('away')
  })
  it('falls back to home score when no winner_team_id', () => {
    expect(knockoutWinnerTeamId({ ...base, home_score: 2, away_score: 1 })).toBe('home')
  })
  it('falls back to away score when no winner_team_id', () => {
    expect(knockoutWinnerTeamId({ ...base, home_score: 1, away_score: 2 })).toBe('away')
  })
  it('returns null for an undecided draw', () => {
    expect(knockoutWinnerTeamId({ ...base, home_score: 1, away_score: 1 })).toBeNull()
  })
})
