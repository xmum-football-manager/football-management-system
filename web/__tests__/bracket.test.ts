import { describe, it, expect } from 'vitest'
import {
  groupByKnockoutRound,
  knockoutRoundLabel,
  KNOCKOUT_ROUND_ORDER,
  feederMatchLabel,
  countStrayKnockoutMatches,
} from '@/lib/bracket'

type M = { id: string; knockout_round: string | null }
const m = (id: string, r: string | null): M => ({ id, knockout_round: r })

describe('groupByKnockoutRound', () => {
  it('orders rounds earliest→latest regardless of input order', () => {
    const out = groupByKnockoutRound([m('a', 'final'), m('b', 'qf'), m('c', 'sf'), m('d', 'qf')])
    expect(out.map((r) => r.round)).toEqual(['qf', 'sf', 'final'])
    expect(out[0].matches.map((x) => x.id)).toEqual(['b', 'd'])
  })

  it('drops matches with null/unknown round', () => {
    const out = groupByKnockoutRound([m('a', null), m('b', 'sf'), m('c', 'bogus')])
    expect(out.map((r) => r.round)).toEqual(['sf'])
    expect(out[0].matches.map((x) => x.id)).toEqual(['b'])
  })

  it('returns empty array for no matches', () => {
    expect(groupByKnockoutRound([])).toEqual([])
  })

  it('preserves input order within a round', () => {
    const out = groupByKnockoutRound([m('x', 'sf'), m('y', 'sf')])
    expect(out).toHaveLength(1)
    expect(out[0].matches.map((x) => x.id)).toEqual(['x', 'y'])
  })
})

describe('KNOCKOUT_ROUND_ORDER', () => {
  it('exposes canonical round order', () => {
    expect(KNOCKOUT_ROUND_ORDER).toEqual(['r32', 'r16', 'qf', 'sf', 'final'])
  })
})

describe('feederMatchLabel', () => {
  it('labels a feeder reference as "Winner of {round} #{n}"', () => {
    expect(feederMatchLabel('qf', 1)).toBe('Winner of Quarterfinals #1')
    expect(feederMatchLabel('sf', 2)).toBe('Winner of Semifinals #2')
  })
})

describe('countStrayKnockoutMatches', () => {
  it('counts matches with a null or unknown round (cannot be placed in the bracket)', () => {
    expect(
      countStrayKnockoutMatches([m('a', 'sf'), m('b', null), m('c', 'bogus'), m('d', 'final')]),
    ).toBe(2)
  })

  it('returns 0 when every match has a valid round', () => {
    expect(countStrayKnockoutMatches([m('a', 'sf'), m('b', 'sf'), m('c', 'final')])).toBe(0)
  })

  it('returns 0 for no matches', () => {
    expect(countStrayKnockoutMatches([])).toBe(0)
  })
})

describe('knockoutRoundLabel', () => {
  it('maps each round to a human label', () => {
    expect(knockoutRoundLabel('r32')).toBe('Round of 32')
    expect(knockoutRoundLabel('r16')).toBe('Round of 16')
    expect(knockoutRoundLabel('qf')).toBe('Quarterfinals')
    expect(knockoutRoundLabel('sf')).toBe('Semifinals')
    expect(knockoutRoundLabel('final')).toBe('Final')
  })
})
