import { describe, it, expect } from 'vitest'
import { shouldShowKnockoutCTA, canEditQualifiers, allGroupMatchesFinished } from '@/lib/overview-utils'
import type { MatchPhase, MatchStatus, TournamentFormat } from '@/lib/supabase/types'

const m = (phase: MatchPhase, status: MatchStatus) => ({ phase, status })

describe('shouldShowKnockoutCTA', () => {
  it('returns false when format is round_robin', () => {
    const matches = [m('group', 'finished')]
    expect(shouldShowKnockoutCTA('round_robin', matches)).toBe(false)
  })

  it('returns false when format is knockout', () => {
    const matches = [m('knockout', 'finished')]
    expect(shouldShowKnockoutCTA('knockout', matches)).toBe(false)
  })

  it('returns false when format is round_robin_knockout but no group matches', () => {
    expect(shouldShowKnockoutCTA('round_robin_knockout', [])).toBe(false)
  })

  it('returns false when group matches exist but some are not finished', () => {
    const matches = [m('group', 'finished'), m('group', 'scheduled')]
    expect(shouldShowKnockoutCTA('round_robin_knockout', matches)).toBe(false)
  })

  it('returns false when all group matches are finished but knockout matches already exist', () => {
    const matches = [m('group', 'finished'), m('knockout', 'scheduled')]
    expect(shouldShowKnockoutCTA('round_robin_knockout', matches)).toBe(false)
  })

  it('returns true when format is round_robin_knockout, all group matches finished, no knockout matches', () => {
    const matches = [m('group', 'finished'), m('group', 'finished')]
    expect(shouldShowKnockoutCTA('round_robin_knockout', matches)).toBe(true)
  })
})

describe('allGroupMatchesFinished — gates the knockout tab', () => {
  it('false when no group matches exist', () => {
    expect(allGroupMatchesFinished([])).toBe(false)
    expect(allGroupMatchesFinished([m('knockout', 'scheduled')])).toBe(false)
  })

  it('false when a group match is unfinished', () => {
    expect(allGroupMatchesFinished([m('group', 'finished'), m('group', 'live')])).toBe(false)
  })

  it('true when every group match is finished', () => {
    expect(allGroupMatchesFinished([m('group', 'finished'), m('group', 'finished')])).toBe(true)
  })

  // Regression for the same-group-final bug: a knockout final between two teams
  // from the same group has equal group_labels. The old heuristic miscounted it
  // as an unfinished group match and locked the KO tab forever. Reading `phase`
  // must keep it OUT of the group set, so the tab unlocks once groups finish.
  it('stays true with a scheduled same-group knockout final present', () => {
    const matches = [
      m('group', 'finished'),
      m('group', 'finished'),
      m('knockout', 'finished'),   // SF
      m('knockout', 'finished'),   // SF
      m('knockout', 'scheduled'),  // same-group final, not yet played
    ]
    expect(allGroupMatchesFinished(matches)).toBe(true)
  })
})

describe('canEditQualifiers', () => {
  it('returns false when not admin (even if saved, no bracket)', () => {
    expect(canEditQualifiers(false, true, false)).toBe(false)
  })

  it('returns false when not saved yet (even if admin, no bracket)', () => {
    expect(canEditQualifiers(true, false, false)).toBe(false)
  })

  it('returns false when bracket exists (even if admin and saved)', () => {
    expect(canEditQualifiers(true, true, true)).toBe(false)
  })

  it('returns true when admin + saved + no bracket', () => {
    expect(canEditQualifiers(true, true, false)).toBe(true)
  })
})
