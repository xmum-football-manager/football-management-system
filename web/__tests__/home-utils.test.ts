import { describe, it, expect } from 'vitest'
import { statusBadge, statusRail, formatDateRange, formatLabel } from '@/lib/home-utils'

describe('statusBadge', () => {
  it('active returns Active label with lime color and green bg', () => {
    const result = statusBadge('active')
    expect(result).toEqual({
      bg: 'rgba(163,230,53,0.12)',
      border: 'rgba(163,230,53,0.45)',
      color: 'var(--brand-lime)',
      label: 'Active',
    })
  })

  it('setup returns Setup label with blue color', () => {
    const result = statusBadge('setup')
    expect(result).toEqual({
      bg: 'rgba(56,189,248,0.12)',
      border: 'rgba(56,189,248,0.4)',
      color: '#7DD3FC',
      label: 'Setup',
    })
  })

  it('finished returns Finished label with dark color', () => {
    const result = statusBadge('finished')
    expect(result).toEqual({
      bg: 'var(--ink-800)',
      border: 'var(--ink-700)',
      color: 'var(--ink-300)',
      label: 'Finished',
    })
  })

  it('unknown status falls back to Finished behavior', () => {
    const result = statusBadge('unknown')
    expect(result).toEqual({
      bg: 'var(--ink-800)',
      border: 'var(--ink-700)',
      color: 'var(--ink-300)',
      label: 'Finished',
    })
  })
})

describe('statusRail', () => {
  it('active returns var(--brand-lime)', () => {
    expect(statusRail('active')).toBe('var(--brand-lime)')
  })

  it('setup returns #7DD3FC', () => {
    expect(statusRail('setup')).toBe('#7DD3FC')
  })

  it('finished returns var(--ink-600)', () => {
    expect(statusRail('finished')).toBe('var(--ink-600)')
  })

  it('unknown status returns var(--ink-600)', () => {
    expect(statusRail('anything-else')).toBe('var(--ink-600)')
  })
})

describe('formatDateRange', () => {
  it('single date (null end) returns just start date formatted', () => {
    expect(formatDateRange('2025-01-15', null)).toBe('15 Jan')
  })

  it('date range returns "D Mon – D Mon YYYY" format', () => {
    expect(formatDateRange('2025-01-15', '2025-03-20')).toBe('15 Jan – 20 Mar 2025')
  })

  it('date range with different years returns cross-year format', () => {
    expect(formatDateRange('2024-12-01', '2025-01-15')).toBe('1 Dec – 15 Jan 2025')
  })

  it('date range same month returns correct format', () => {
    expect(formatDateRange('2025-06-01', '2025-06-30')).toBe('1 Jun – 30 Jun 2025')
  })
})

describe('formatLabel', () => {
  it('knockout returns Knockout', () => {
    expect(formatLabel('knockout')).toBe('Knockout')
  })

  it('round_robin returns Round Robin', () => {
    expect(formatLabel('round_robin')).toBe('Round Robin')
  })

  it('round_robin_knockout returns Round Robin + Knockout', () => {
    expect(formatLabel('round_robin_knockout')).toBe('Round Robin + Knockout')
  })

  it('unknown format defaults to Round Robin', () => {
    expect(formatLabel('unknown_format')).toBe('Round Robin')
  })
})
