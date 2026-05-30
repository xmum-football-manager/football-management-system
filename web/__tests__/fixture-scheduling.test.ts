import { describe, it, expect } from 'vitest'
import { computeEndTime, getTournamentDays } from '@/lib/fixture-scheduling'

describe('computeEndTime', () => {
  it('returns start + 2x minutesPerHalf when halftime is disabled', () => {
    expect(computeEndTime('09:00', 45, false, null)).toBe('10:30')
  })

  it('adds halftime_minutes when halftime is enabled', () => {
    expect(computeEndTime('09:00', 45, true, 15)).toBe('10:45')
  })

  it('treats null halftime_minutes as 0 when halftime is enabled', () => {
    expect(computeEndTime('09:00', 45, true, null)).toBe('10:30')
  })

  it('handles wrap past midnight', () => {
    expect(computeEndTime('23:00', 45, false, null)).toBe('00:30')
  })

  it('works with 30-minute halves', () => {
    expect(computeEndTime('14:00', 30, true, 10)).toBe('15:10')
  })
})

describe('getTournamentDays', () => {
  it('returns one day when start equals end', () => {
    const days = getTournamentDays('2026-01-15', '2026-01-15')
    expect(days).toHaveLength(1)
    expect(days[0]).toEqual({ label: 'Day 1 (15 Jan)', date: '2026-01-15' })
  })

  it('returns correct range for multi-day tournament', () => {
    const days = getTournamentDays('2026-01-15', '2026-01-17')
    expect(days).toHaveLength(3)
    expect(days[0]).toEqual({ label: 'Day 1 (15 Jan)', date: '2026-01-15' })
    expect(days[1]).toEqual({ label: 'Day 2 (16 Jan)', date: '2026-01-16' })
    expect(days[2]).toEqual({ label: 'Day 3 (17 Jan)', date: '2026-01-17' })
  })

  it('formats the date label with abbreviated month', () => {
    const days = getTournamentDays('2026-12-31', '2026-12-31')
    expect(days[0].label).toBe('Day 1 (31 Dec)')
  })
})
