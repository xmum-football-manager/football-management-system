import { describe, it, expect } from 'vitest'
import { canEditTournamentMeta, canEditFormat } from '@/lib/lock-rules'

describe('canEditTournamentMeta', () => {
  it('allows editing when setup', () => expect(canEditTournamentMeta('setup')).toBe(true))
  it('allows editing when active', () => expect(canEditTournamentMeta('active')).toBe(true))
  it('locks when finished', () => expect(canEditTournamentMeta('finished')).toBe(false))
  it('locks when archived', () => expect(canEditTournamentMeta('archived')).toBe(false))
})

describe('canEditFormat', () => {
  it('allows editing when setup and no match scheduled', () => {
    expect(canEditFormat('setup', null)).toBe(true)
  })
  it('locks when setup but first match scheduled', () => {
    expect(canEditFormat('setup', '2026-05-01T10:00:00Z')).toBe(false)
  })
  it('locks when active even with no match scheduled', () => {
    expect(canEditFormat('active', null)).toBe(false)
  })
  it('locks when finished', () => {
    expect(canEditFormat('finished', null)).toBe(false)
  })
})
