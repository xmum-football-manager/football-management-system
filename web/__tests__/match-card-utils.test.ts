import { describe, it, expect } from 'vitest'

// Extracted from MatchCard.tsx — these are pure utility functions
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

describe('formatTime', () => {
  it('formats ISO time to 12-hour with AM/PM', () => {
    const result = formatTime('2026-06-01T09:30:00+08:00')
    expect(result).toMatch(/09:30/)
  })

  it('handles afternoon times', () => {
    const result = formatTime('2026-06-01T14:00:00+08:00')
    expect(result).toMatch(/02:00/)
  })

  it('handles midnight', () => {
    const result = formatTime('2026-06-01T00:00:00+08:00')
    expect(result).toMatch(/12:00/)
  })
})

describe('formatDate', () => {
  it('formats ISO date to short weekday, month, day', () => {
    const result = formatDate('2026-06-01T00:00:00Z')
    expect(result).toContain('Jun')
    expect(result).toContain('1')
  })

  it('includes weekday abbreviation', () => {
    const result = formatDate('2026-06-01T00:00:00Z')
    // June 1, 2026 is a Monday
    expect(result).toMatch(/Mon/)
  })
})

describe('initials', () => {
  it('returns first letter of each word uppercased', () => {
    expect(initials('Manchester United')).toBe('MU')
  })

  it('handles single word names', () => {
    expect(initials('Chelsea')).toBe('C')
  })

  it('limits to first two words', () => {
    expect(initials('Real Madrid Club de Futbol')).toBe('RM')
  })

  it('handles empty string', () => {
    expect(initials('')).toBe('')
  })

  it('handles single character', () => {
    expect(initials('A')).toBe('A')
  })
})
