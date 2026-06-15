import { describe, it, expect } from 'vitest'
import { phaseSchedulingStatus } from '@/lib/phase-schedule-guard'

type M = { phase: string | null; match_time: string | null }

const gSched = (match_time: string | null): M => ({ phase: 'group', match_time })
const koSched = (match_time: string | null): M => ({ phase: 'knockout', match_time })

describe('phaseSchedulingStatus', () => {
  it('returns true for both phases when no matches exist', () => {
    expect(phaseSchedulingStatus([])).toEqual({ group: true, knockout: true })
  })

  it('returns group:false when any group match has no time', () => {
    const matches = [gSched('2026-06-10T10:00:00Z'), gSched(null)]
    expect(phaseSchedulingStatus(matches).group).toBe(false)
  })

  it('returns group:true when all group matches have a time', () => {
    const matches = [gSched('2026-06-10T10:00:00Z'), gSched('2026-06-10T12:00:00Z')]
    expect(phaseSchedulingStatus(matches).group).toBe(true)
  })

  it('returns knockout:false when any ko match has no time', () => {
    const matches = [koSched('2026-06-10T10:00:00Z'), koSched(null)]
    expect(phaseSchedulingStatus(matches).knockout).toBe(false)
  })

  it('returns knockout:true when all ko matches have a time', () => {
    const matches = [koSched('2026-06-10T10:00:00Z')]
    expect(phaseSchedulingStatus(matches).knockout).toBe(true)
  })

  it('evaluates phases independently', () => {
    const matches = [gSched(null), koSched('2026-06-10T10:00:00Z')]
    expect(phaseSchedulingStatus(matches)).toEqual({ group: false, knockout: true })
  })

  it('ignores matches with null phase', () => {
    const matches = [{ phase: null, match_time: null }]
    expect(phaseSchedulingStatus(matches)).toEqual({ group: true, knockout: true })
  })
})
