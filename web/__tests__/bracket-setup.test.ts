import { describe, it, expect } from 'vitest'

interface Team { id: string; name: string }

interface Pairing {
  home: string      // team id or ''
  away: string      // team id or ''
  matchTime: string // ISO datetime string or ''
}

function buildEmptyPairings(count: number): Pairing[] {
  return Array.from({ length: count }, () => ({ home: '', away: '', matchTime: '' }))
}

function assignedIds(pairings: Pairing[]): Set<string> {
  return new Set(pairings.flatMap((p) => [p.home, p.away].filter(Boolean)))
}

function setSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away', teamId: string): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, [slot]: teamId } : p))
}

function clearSlot(pairings: Pairing[], matchIdx: number, slot: 'home' | 'away'): Pairing[] {
  return setSlot(pairings, matchIdx, slot, '')
}

function setMatchTime(pairings: Pairing[], matchIdx: number, value: string): Pairing[] {
  return pairings.map((p, i) => (i === matchIdx ? { ...p, matchTime: value } : p))
}

function allFilled(pairings: Pairing[]): boolean {
  return pairings.every((p) => p.home && p.away && p.matchTime)
}

function placeholderLabels(pairings: Pairing[], teams: Team[]): string[] {
  return pairings.flatMap((p) => [
    p.home ? (teams.find((t) => t.id === p.home)?.name ?? '?') : 'TBD',
    p.away ? (teams.find((t) => t.id === p.away)?.name ?? '?') : 'TBD',
  ])
}

describe('buildEmptyPairings', () => {
  it('creates N empty pairings', () => {
    const result = buildEmptyPairings(4)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual({ home: '', away: '', matchTime: '' })
    expect(result[3]).toEqual({ home: '', away: '', matchTime: '' })
  })

  it('creates 0 pairings when count is 0', () => {
    expect(buildEmptyPairings(0)).toEqual([])
  })
})

describe('assignedIds', () => {
  it('returns all non-empty ids from home and away', () => {
    const pairings: Pairing[] = [
      { home: 'a', away: 'b', matchTime: '' },
      { home: 'c', away: 'd', matchTime: '' },
    ]
    expect(assignedIds(pairings)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('ignores empty strings', () => {
    const pairings: Pairing[] = [
      { home: 'a', away: '', matchTime: '' },
      { home: '', away: '', matchTime: '' },
    ]
    expect(assignedIds(pairings)).toEqual(new Set(['a']))
  })
})

describe('setSlot', () => {
  it('sets home on the correct match index', () => {
    const pairings = buildEmptyPairings(3)
    const result = setSlot(pairings, 1, 'home', 'team-1')
    expect(result[1].home).toBe('team-1')
    expect(result[0].home).toBe('')
    expect(result[2].home).toBe('')
  })

  it('does not mutate the original array', () => {
    const pairings = buildEmptyPairings(2)
    setSlot(pairings, 0, 'away', 'team-x')
    expect(pairings[0].away).toBe('')
  })
})

describe('clearSlot', () => {
  it('resets a filled slot to empty string', () => {
    const pairings: Pairing[] = [{ home: 'team-1', away: 'team-2', matchTime: '' }]
    const result = clearSlot(pairings, 0, 'home')
    expect(result[0].home).toBe('')
    expect(result[0].away).toBe('team-2')
  })
})

describe('setMatchTime', () => {
  it('sets matchTime on the correct match index', () => {
    const pairings = buildEmptyPairings(2)
    const result = setMatchTime(pairings, 0, '2026-06-01T15:00:00Z')
    expect(result[0].matchTime).toBe('2026-06-01T15:00:00Z')
    expect(result[1].matchTime).toBe('')
  })
})

describe('allFilled', () => {
  it('returns false when any team slot is empty', () => {
    const pairings: Pairing[] = [
      { home: 'a', away: '', matchTime: '2026-06-01T15:00:00Z' },
    ]
    expect(allFilled(pairings)).toBe(false)
  })

  it('returns false when matchTime is empty', () => {
    const pairings: Pairing[] = [
      { home: 'a', away: 'b', matchTime: '' },
    ]
    expect(allFilled(pairings)).toBe(false)
  })

  it('returns true when all slots and times are filled', () => {
    const pairings: Pairing[] = [
      { home: 'a', away: 'b', matchTime: '2026-06-01T15:00:00Z' },
      { home: 'c', away: 'd', matchTime: '2026-06-01T17:00:00Z' },
    ]
    expect(allFilled(pairings)).toBe(true)
  })
})

describe('placeholderLabels', () => {
  it('shows team name for filled slots and TBD for empty slots', () => {
    const teams: Team[] = [
      { id: 'a', name: 'Arsenal' },
      { id: 'b', name: 'Barcelona' },
    ]
    const pairings: Pairing[] = [
      { home: 'a', away: '', matchTime: '' },
      { home: '', away: 'b', matchTime: '' },
    ]
    expect(placeholderLabels(pairings, teams)).toEqual([
      'Arsenal', 'TBD',
      'TBD', 'Barcelona',
    ])
  })

  it('shows ? for a filled slot whose id is not in teams', () => {
    const teams: Team[] = [{ id: 'a', name: 'Arsenal' }]
    const pairings: Pairing[] = [{ home: 'unknown', away: 'a', matchTime: '' }]
    expect(placeholderLabels(pairings, teams)).toEqual(['?', 'Arsenal'])
  })
})
