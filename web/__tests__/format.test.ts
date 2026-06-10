import { describe, it, expect } from 'vitest'
import {
  matchElapsedSeconds,
  formatElapsed,
  tournamentDayLabel,
  expectedMatchRange,
} from '../lib/format'

const T0 = '2026-06-15T10:00:00.000Z'
const T1 = '2026-06-15T10:20:00.000Z' // 20 min after start = halftime_started_at
const T2 = '2026-06-15T10:35:00.000Z' // 15 min halftime break = second_half_started_at
const NOW = new Date('2026-06-15T10:45:00.000Z') // 10 min into second half

describe('matchElapsedSeconds', () => {
  it('returns 0 when match has not started', () => {
    expect(
      matchElapsedSeconds(
        { match_started_at: null, halftime_started_at: null, second_half_started_at: null },
        NOW,
      ),
    ).toBe(0)
  })

  it('counts up in first half (no halftime_started_at)', () => {
    // 45 minutes into first half
    const now = new Date('2026-06-15T10:45:00.000Z')
    expect(
      matchElapsedSeconds(
        { match_started_at: T0, halftime_started_at: null, second_half_started_at: null },
        now,
      ),
    ).toBe(45 * 60)
  })

  it('freezes at end of first half when at halftime', () => {
    // 1 hour after T0 but no second half started — should return first-half duration (20 min)
    const now = new Date('2026-06-15T11:00:00.000Z')
    expect(
      matchElapsedSeconds(
        { match_started_at: T0, halftime_started_at: T1, second_half_started_at: null },
        now,
      ),
    ).toBe(20 * 60)
  })

  it('adds second-half elapsed when second half is running', () => {
    // firstHalf = 20min, secondHalf so far = 10min → 30min total
    expect(
      matchElapsedSeconds(
        { match_started_at: T0, halftime_started_at: T1, second_half_started_at: T2 },
        NOW,
      ),
    ).toBe(30 * 60)
  })
})

describe('formatElapsed', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatElapsed(0)).toBe('0:00')
  })

  it('formats 541 seconds as 9:01', () => {
    expect(formatElapsed(541)).toBe('9:01')
  })

  it('formats 3792 seconds as 63:12', () => {
    expect(formatElapsed(3792)).toBe('63:12')
  })

  it('zero-pads seconds', () => {
    expect(formatElapsed(60)).toBe('1:00')
  })
})

describe('tournamentDayLabel', () => {
  it('returns Day 1 of 3 for first day of a 3-day tournament', () => {
    const tournament = { start_date: '2026-06-15', end_date: '2026-06-17' }
    const result = tournamentDayLabel(tournament, '2026-06-15T10:00:00.000Z')
    expect(result).toMatch(/^Day 1 of 3/)
  })

  it('returns Day 2 of 3 for second day', () => {
    const tournament = { start_date: '2026-06-15', end_date: '2026-06-17' }
    const result = tournamentDayLabel(tournament, '2026-06-16T14:00:00.000Z')
    expect(result).toMatch(/^Day 2 of 3/)
  })

  it('includes formatted date in parentheses', () => {
    const tournament = { start_date: '2026-06-15', end_date: '2026-06-17' }
    const result = tournamentDayLabel(tournament, '2026-06-15T10:00:00.000Z')
    expect(result).toContain('June 15')
  })

  it('returns Day 1 of 1 for single-day tournament', () => {
    const tournament = { start_date: '2026-06-20', end_date: '2026-06-20' }
    const result = tournamentDayLabel(tournament, '2026-06-20T09:00:00.000Z')
    expect(result).toMatch(/^Day 1 of 1/)
  })
})

describe('expectedMatchRange', () => {
  it('computes range with halftime enabled', () => {
    const tournament = {
      minutes_per_half: 45,
      halftime_enabled: true,
      halftime_minutes: 15,
    }
    // 45+45+15 = 105 minutes. Start 16:00 → end 17:45
    const result = expectedMatchRange(tournament, '2026-06-15T16:00:00.000Z')
    expect(result).toContain('–')
    const parts = result.split('–').map((s) => s.trim())
    expect(parts).toHaveLength(2)
  })

  it('computes range without halftime', () => {
    const tournament = {
      minutes_per_half: 20,
      halftime_enabled: false,
      halftime_minutes: 10,
    }
    // 20+20+0 = 40 min. Start 16:00 → end 16:40
    const result = expectedMatchRange(tournament, '2026-06-15T16:00:00.000Z')
    expect(result).toContain('–')
  })
})
