import { describe, it, expect } from 'vitest'
import { shouldShowKnockoutCTA, canEditQualifiers } from '@/lib/overview-utils'
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
