import { describe, it, expect } from 'vitest'
import { canEditDates, canManageTeams, canAddFixture, canDeleteFixture, canEditMatchTime } from '@/lib/lock-rules'

describe('canEditDates', () => {
  it('allows in setup', () => { expect(canEditDates('setup')).toBe(true) })
  it('locks when active', () => { expect(canEditDates('active')).toBe(false) })
  it('locks when finished', () => { expect(canEditDates('finished')).toBe(false) })
  it('locks when archived', () => { expect(canEditDates('archived')).toBe(false) })
})

describe('canManageTeams', () => {
  it('allows in setup', () => { expect(canManageTeams('setup')).toBe(true) })
  it('locks when active', () => { expect(canManageTeams('active')).toBe(false) })
  it('locks when finished', () => { expect(canManageTeams('finished')).toBe(false) })
  it('locks when archived', () => { expect(canManageTeams('archived')).toBe(false) })
})

describe('canAddFixture', () => {
  it('allows in setup', () => { expect(canAddFixture('setup')).toBe(true) })
  it('allows when active', () => { expect(canAddFixture('active')).toBe(true) })
  it('locks when finished', () => { expect(canAddFixture('finished')).toBe(false) })
  it('locks when archived', () => { expect(canAddFixture('archived')).toBe(false) })
})

describe('canDeleteFixture', () => {
  it('allows in setup', () => { expect(canDeleteFixture('setup')).toBe(true) })
  it('allows when active', () => { expect(canDeleteFixture('active')).toBe(true) })
  it('locks when finished', () => { expect(canDeleteFixture('finished')).toBe(false) })
})

describe('canEditMatchTime', () => {
  it('allows when setup + scheduled', () => { expect(canEditMatchTime('setup', 'scheduled')).toBe(true) })
  it('allows when active + scheduled', () => { expect(canEditMatchTime('active', 'scheduled')).toBe(true) })
  it('locks when active + live', () => { expect(canEditMatchTime('active', 'live')).toBe(false) })
  it('locks when active + halftime', () => { expect(canEditMatchTime('active', 'halftime')).toBe(false) })
  it('locks when active + finished', () => { expect(canEditMatchTime('active', 'finished')).toBe(false) })
  it('locks when finished + scheduled', () => { expect(canEditMatchTime('finished', 'scheduled')).toBe(false) })
  it('locks when archived + scheduled', () => { expect(canEditMatchTime('archived', 'scheduled')).toBe(false) })
})
