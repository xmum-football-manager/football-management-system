import { describe, it, expect } from 'vitest'
import { canRegenerateFixtures } from '@/lib/lock-rules'

describe('canRegenerateFixtures', () => {
  it('returns true when there are no existing matches', () => {
    expect(canRegenerateFixtures([])).toBe(true)
  })

  it('returns true when all matches are scheduled', () => {
    expect(canRegenerateFixtures([{ status: 'scheduled' }, { status: 'scheduled' }])).toBe(true)
  })

  it('returns false when one match is live', () => {
    expect(canRegenerateFixtures([{ status: 'scheduled' }, { status: 'live' }])).toBe(false)
  })

  it('returns false when one match is finished', () => {
    expect(canRegenerateFixtures([{ status: 'finished' }, { status: 'scheduled' }])).toBe(false)
  })
})
