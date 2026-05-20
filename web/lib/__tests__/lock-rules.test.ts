import { describe, it, expect } from 'vitest'
import { canAddFixture, canDeleteFixture, canManageTeams, canEditDates } from '../lock-rules'
import type { TournamentStatus } from '@/lib/supabase/types'

describe('canAddFixture', () => {
  it('returns true for setup, active, and knockout', () => {
    expect(canAddFixture('setup')).toBe(true)
    expect(canAddFixture('active')).toBe(true)
    expect(canAddFixture('knockout')).toBe(true)
  })
  it('returns false for bracket_setup (bracket manages its own fixtures)', () => {
    expect(canAddFixture('bracket_setup')).toBe(false)
  })
  it('returns false for finished and archived', () => {
    expect(canAddFixture('finished')).toBe(false)
    expect(canAddFixture('archived')).toBe(false)
  })
})

describe('canDeleteFixture', () => {
  it('returns true for setup, active, and knockout', () => {
    expect(canDeleteFixture('setup')).toBe(true)
    expect(canDeleteFixture('active')).toBe(true)
    expect(canDeleteFixture('knockout')).toBe(true)
  })
  it('returns false for bracket_setup, finished, archived', () => {
    expect(canDeleteFixture('bracket_setup')).toBe(false)
    expect(canDeleteFixture('finished')).toBe(false)
    expect(canDeleteFixture('archived')).toBe(false)
  })
})

describe('canManageTeams', () => {
  it('returns true only for setup', () => {
    expect(canManageTeams('setup')).toBe(true)
  })
  it('returns false for all live and post-live statuses', () => {
    const locked: TournamentStatus[] = ['active', 'bracket_setup', 'knockout', 'finished', 'archived']
    locked.forEach(s => expect(canManageTeams(s)).toBe(false))
  })
})

describe('canEditDates', () => {
  it('returns true only for setup', () => {
    expect(canEditDates('setup')).toBe(true)
  })
  it('returns false once tournament is live or beyond', () => {
    const locked: TournamentStatus[] = ['active', 'bracket_setup', 'knockout', 'finished', 'archived']
    locked.forEach(s => expect(canEditDates(s)).toBe(false))
  })
})
