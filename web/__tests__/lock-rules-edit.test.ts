import { describe, it, expect } from 'vitest'
import { canEditTournamentMeta, canEditFormat, canEditTournamentName, canEditVenueDescription } from '@/lib/lock-rules'

describe('canEditTournamentMeta', () => {
  it('allows editing when setup', () => expect(canEditTournamentMeta('setup')).toBe(true))
  it('allows editing when active', () => expect(canEditTournamentMeta('active')).toBe(true))
  it('locks when finished', () => expect(canEditTournamentMeta('finished')).toBe(false))
  it('locks when archived', () => expect(canEditTournamentMeta('archived')).toBe(false))
})

describe('canEditTournamentName', () => {
  const farFuture = new Date()
  farFuture.setDate(farFuture.getDate() + 30)
  const farDate = farFuture.toISOString().slice(0, 10)

  const near = new Date()
  near.setDate(near.getDate() + 10)
  const nearDate = near.toISOString().slice(0, 10)

  it('allows editing when setup and start is 30 days away', () => {
    expect(canEditTournamentName('setup', farDate)).toBe(true)
  })
  it('allows editing when active and start is 30 days away', () => {
    expect(canEditTournamentName('active', farDate)).toBe(true)
  })
  it('locks when start is only 10 days away (within 14-day window)', () => {
    expect(canEditTournamentName('setup', nearDate)).toBe(false)
  })
  it('locks when finished regardless of date', () => {
    expect(canEditTournamentName('finished', farDate)).toBe(false)
  })
  it('locks when archived regardless of date', () => {
    expect(canEditTournamentName('archived', farDate)).toBe(false)
  })
})

describe('canEditVenueDescription', () => {
  it('allows editing when setup', () => expect(canEditVenueDescription('setup')).toBe(true))
  it('locks when active', () => expect(canEditVenueDescription('active')).toBe(false))
  it('locks when finished', () => expect(canEditVenueDescription('finished')).toBe(false))
  it('locks when archived', () => expect(canEditVenueDescription('archived')).toBe(false))
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
