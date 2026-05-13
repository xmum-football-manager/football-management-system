import { describe, it, expect } from 'vitest'
import { validateStep, DEFAULT_WIZARD_FORM, type WizardFormValue } from '@/lib/wizard-validation'

const base: WizardFormValue = {
  ...DEFAULT_WIZARD_FORM,
  name: 'Spring Cup',
  start_date: '2026-06-01',
  end_date: '2026-06-15',
  num_groups: 2,
  teams_per_group: 4,
  advance_per_group: 2,
  knockout_start_round: 'top_8',
  seeding_method: 'by_standings',
  minutes_per_half: 45,
  halftime_minutes: 15,
  points_win: 1,
  points_draw: 0.5,
  points_loss: 0,
}

describe('validateStep 1 — Basic Info', () => {
  it('passes with valid data', () => {
    expect(validateStep(1, base)).toEqual({})
  })
  it('requires name', () => {
    expect(validateStep(1, { ...base, name: '' })).toHaveProperty('name')
  })
  it('requires start_date', () => {
    expect(validateStep(1, { ...base, start_date: '' })).toHaveProperty('start_date')
  })
  it('requires end_date', () => {
    expect(validateStep(1, { ...base, end_date: '' })).toHaveProperty('end_date')
  })
  it('rejects end_date before start_date', () => {
    expect(validateStep(1, { ...base, end_date: '2026-05-01' })).toHaveProperty('end_date')
  })
  it('allows end_date equal to start_date', () => {
    expect(validateStep(1, { ...base, end_date: '2026-06-01' })).toEqual({})
  })
})

describe('validateStep 2 — Format (round_robin)', () => {
  it('passes with valid round_robin data', () => {
    expect(validateStep(2, { ...base, format: 'round_robin' })).toEqual({})
  })
  it('requires num_groups for round_robin', () => {
    expect(validateStep(2, { ...base, format: 'round_robin', num_groups: '' })).toHaveProperty('num_groups')
  })
  it('requires teams_per_group >= 2', () => {
    expect(validateStep(2, { ...base, format: 'round_robin', teams_per_group: 1 })).toHaveProperty('teams_per_group')
  })
  it('does not require advance_per_group for round_robin-only', () => {
    expect(validateStep(2, { ...base, format: 'round_robin', advance_per_group: '' })).toEqual({})
  })
})

describe('validateStep 2 — Format (round_robin_knockout)', () => {
  it('passes with valid hybrid data', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout' })).toEqual({})
  })
  it('requires advance_per_group for hybrid', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout', advance_per_group: '' })).toHaveProperty('advance_per_group')
  })
  it('requires knockout_start_round for hybrid', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout', knockout_start_round: '' })).toHaveProperty('knockout_start_round')
  })
  it('requires seeding_method for hybrid', () => {
    expect(validateStep(2, { ...base, format: 'round_robin_knockout', seeding_method: '' })).toHaveProperty('seeding_method')
  })
})

describe('validateStep 2 — Format (knockout)', () => {
  it('passes with valid knockout data', () => {
    expect(validateStep(2, { ...base, format: 'knockout' })).toEqual({})
  })
  it('does not require num_groups for knockout', () => {
    expect(validateStep(2, { ...base, format: 'knockout', num_groups: '' })).toEqual({})
  })
  it('requires knockout_start_round', () => {
    expect(validateStep(2, { ...base, format: 'knockout', knockout_start_round: '' })).toHaveProperty('knockout_start_round')
  })
})

describe('validateStep 3 — Match Rules', () => {
  it('passes with valid data', () => {
    expect(validateStep(3, base)).toEqual({})
  })
  it('requires minutes_per_half', () => {
    expect(validateStep(3, { ...base, minutes_per_half: '' })).toHaveProperty('minutes_per_half')
  })
  it('requires halftime_minutes when halftime_enabled', () => {
    expect(validateStep(3, { ...base, halftime_enabled: true, halftime_minutes: '' })).toHaveProperty('halftime_minutes')
  })
  it('does not require halftime_minutes when halftime disabled', () => {
    expect(validateStep(3, { ...base, halftime_enabled: false, halftime_minutes: '' })).toEqual({})
  })
})

describe('validateStep 4 — Points & Scoring', () => {
  it('passes with default 1/0.5/0', () => {
    expect(validateStep(4, base)).toEqual({})
  })
  it('rejects win equal to draw', () => {
    expect(validateStep(4, { ...base, points_win: 1, points_draw: 1 })).toHaveProperty('points_win')
  })
  it('rejects draw equal to loss', () => {
    expect(validateStep(4, { ...base, points_draw: 0, points_loss: 0 })).toHaveProperty('points_draw')
  })
  it('rejects win less than draw', () => {
    expect(validateStep(4, { ...base, points_win: 0, points_draw: 1 })).toHaveProperty('points_win')
  })
  it('requires win points', () => {
    expect(validateStep(4, { ...base, points_win: '' })).toHaveProperty('points_win')
  })
})
