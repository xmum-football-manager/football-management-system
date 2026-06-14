import { describe, it, expect } from 'vitest'
import { canResetBracket } from '@/lib/lock-rules'

describe('canResetBracket', () => {
  it('returns true when there are no matches', () => {
    expect(canResetBracket([])).toBe(true)
  })

  it('returns true when all matches are scheduled', () => {
    expect(canResetBracket([{ status: 'scheduled' }, { status: 'scheduled' }])).toBe(true)
  })

  it('returns false when one match is live', () => {
    expect(canResetBracket([{ status: 'scheduled' }, { status: 'live' }])).toBe(false)
  })

  it('returns false when one match is finished', () => {
    expect(canResetBracket([{ status: 'finished' }, { status: 'scheduled' }])).toBe(false)
  })
})
