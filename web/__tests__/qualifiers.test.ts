import { describe, it, expect } from 'vitest'
import { computeGroupStandings, detectBoundaryTies, groupStageComplete, expectedBracketSize, validatePairingEdit } from '@/lib/qualifiers'
import type { TeamStanding } from '@/lib/qualifiers'

const team = (id: string, name: string, group_label: string) => ({ id, name, group_label })

const match = (
  homeId: string,
  awayId: string,
  hs: number,
  as_: number,
  status = 'finished',
) => ({
  status,
  home_team_id: homeId,
  away_team_id: awayId,
  home_score: hs,
  away_score: as_,
})

describe('computeGroupStandings', () => {
  it('awards 3 pts for a win, 0 for a loss', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 2, 0)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    const alpha = standings.find(s => s.teamId === 'a')!
    const beta = standings.find(s => s.teamId === 'b')!
    expect(alpha.points).toBe(3)
    expect(beta.points).toBe(0)
  })

  it('awards 1 pt each for a draw', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 1, 1)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.points).toBe(1)
    expect(standings.find(s => s.teamId === 'b')!.points).toBe(1)
  })

  it('ignores non-finished matches', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 3, 0, 'live')]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.points).toBe(0)
  })

  it('computes goal difference correctly', () => {
    const teams = [team('a', 'Alpha', 'A'), team('b', 'Beta', 'A')]
    const matches = [match('a', 'b', 3, 1)]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.gd).toBe(2)
    expect(standings.find(s => s.teamId === 'b')!.gd).toBe(-2)
  })

  it('marks top advancePerGroup teams as qualified per group', () => {
    const teams = [
      team('a', 'Alpha', 'A'), team('b', 'Beta', 'A'), team('c', 'Gamma', 'A'),
    ]
    const matches = [
      match('a', 'b', 3, 0),
      match('a', 'c', 2, 0),
      match('b', 'c', 1, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 1, 2)
    expect(standings.find(s => s.teamId === 'a')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'b')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'c')!.qualified).toBe(false)
  })

  it('breaks ties by goal difference then alphabetical', () => {
    const teams = [
      team('a', 'Alpha', 'A'),
      team('b', 'Beta', 'A'),
      team('c', 'Gamma', 'A'),
    ]
    const matches = [
      match('a', 'c', 2, 0),
      match('b', 'c', 1, 0),
      match('a', 'b', 0, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'a')!.qualified).toBe(true)
    expect(standings.find(s => s.teamId === 'b')!.qualified).toBe(false)
  })

  it('excludes teams with null group_label', () => {
    const teams = [
      team('a', 'Alpha', 'A'),
      { id: 'x', name: 'Orphan', group_label: null },
    ]
    const matches: ReturnType<typeof match>[] = []
    const standings = computeGroupStandings(teams, matches, 1, 1)
    expect(standings.find(s => s.teamId === 'x')).toBeUndefined()
    expect(standings.find(s => s.teamId === 'a')).toBeDefined()
  })

  it('handles multiple groups correctly', () => {
    const teams = [
      team('a', 'Alpha', 'A'), team('b', 'Beta', 'A'),
      team('c', 'Gamma', 'B'), team('d', 'Delta', 'B'),
    ]
    const matches = [
      match('a', 'b', 1, 0),
      match('c', 'd', 1, 0),
    ]
    const standings = computeGroupStandings(teams, matches, 2, 1)
    const ids = standings.filter(s => s.qualified).map(s => s.teamId)
    expect(ids).toContain('a')
    expect(ids).toContain('c')
    expect(ids).not.toContain('b')
    expect(ids).not.toContain('d')
  })
})

const standing = (
  teamId: string,
  groupLabel: string,
  points: number,
  gd: number,
): TeamStanding => ({ teamId, teamName: teamId, groupLabel, points, gd, qualified: false })

describe('detectBoundaryTies', () => {
  it('flags two teams level on points and GD competing for the last slot', () => {
    // Group A, top 2 advance. Alpha is clear; Beta and Gamma are level on
    // points AND goal difference for the single remaining slot.
    const standings = [
      standing('a', 'A', 6, 2),
      standing('b', 'A', 1, -1),
      standing('c', 'A', 1, -1),
    ]
    const ties = detectBoundaryTies(standings, 2)
    expect(ties).toHaveLength(1)
    expect(ties[0].groupLabel).toBe('A')
    expect(ties[0].slots).toBe(1)
    expect(ties[0].contestedTeamIds.sort()).toEqual(['b', 'c'])
  })

  it('returns no tie when the cutoff is unambiguous', () => {
    const standings = [
      standing('a', 'A', 6, 3),
      standing('b', 'A', 3, 0),
      standing('c', 'A', 0, -3),
    ]
    expect(detectBoundaryTies(standings, 2)).toHaveLength(0)
  })

  it('ignores a tie that sits entirely inside the qualifying zone', () => {
    // Alpha and Beta tied but BOTH qualify (top 2) — no decision needed.
    const standings = [
      standing('a', 'A', 4, 1),
      standing('b', 'A', 4, 1),
      standing('c', 'A', 0, -2),
    ]
    expect(detectBoundaryTies(standings, 2)).toHaveLength(0)
  })

  it('flags a tie in each affected group independently', () => {
    const standings = [
      standing('a', 'A', 3, 0), standing('b', 'A', 3, 0),
      standing('c', 'B', 6, 2), standing('d', 'B', 0, -2),
    ]
    const ties = detectBoundaryTies(standings, 1)
    expect(ties).toHaveLength(1)
    expect(ties[0].groupLabel).toBe('A')
    expect(ties[0].contestedTeamIds.sort()).toEqual(['a', 'b'])
  })
})

describe('groupStageComplete', () => {
  it('returns false when there are no group matches', () => {
    expect(groupStageComplete([])).toBe(false)
  })

  it('returns false when a group match is scheduled', () => {
    expect(groupStageComplete([{ phase: 'group', status: 'scheduled' }])).toBe(false)
  })

  it('returns false when a group match is live', () => {
    expect(groupStageComplete([{ phase: 'group', status: 'live' }])).toBe(false)
  })

  it('returns true when all group matches are finished', () => {
    expect(groupStageComplete([
      { phase: 'group', status: 'finished' },
      { phase: 'group', status: 'finished' },
    ])).toBe(true)
  })

  it('ignores knockout-phase matches when deciding', () => {
    expect(groupStageComplete([
      { phase: 'group', status: 'finished' },
      { phase: 'knockout', status: 'scheduled' },
    ])).toBe(true)
  })
})

describe('validatePairingEdit', () => {
  const validMatch = {
    phase: 'knockout' as string | null,
    status: 'scheduled',
    home_source_match_id: null as string | null,
    away_source_match_id: null as string | null,
  }
  const qualifierIds = ['t1', 't2', 't3', 't4']

  it('returns ok:true for a valid first-round pairing edit', () => {
    expect(validatePairingEdit(validMatch, 't1', 't2', qualifierIds, [])).toEqual({ ok: true })
  })

  it('returns ok:true when occupiedByOthers does not contain either team', () => {
    expect(validatePairingEdit(validMatch, 't1', 't2', qualifierIds, ['t3', 't4'])).toEqual({ ok: true })
  })

  it('returns error when phase is not knockout', () => {
    const r = validatePairingEdit({ ...validMatch, phase: 'group' }, 't1', 't2', qualifierIds, [])
    expect('error' in r).toBe(true)
  })

  it('returns error when phase is null', () => {
    const r = validatePairingEdit({ ...validMatch, phase: null }, 't1', 't2', qualifierIds, [])
    expect('error' in r).toBe(true)
  })

  it('returns error when status is not scheduled', () => {
    const r = validatePairingEdit({ ...validMatch, status: 'live' }, 't1', 't2', qualifierIds, [])
    expect('error' in r).toBe(true)
  })

  it('returns error when home_source_match_id is set (later round)', () => {
    const r = validatePairingEdit(
      { ...validMatch, home_source_match_id: 'some-match-id' },
      't1', 't2', qualifierIds, [],
    )
    expect('error' in r).toBe(true)
  })

  it('returns error when away_source_match_id is set (later round)', () => {
    const r = validatePairingEdit(
      { ...validMatch, away_source_match_id: 'some-match-id' },
      't1', 't2', qualifierIds, [],
    )
    expect('error' in r).toBe(true)
  })

  it('returns error when homeId === awayId', () => {
    const r = validatePairingEdit(validMatch, 't1', 't1', qualifierIds, [])
    expect('error' in r).toBe(true)
  })

  it('returns error when homeId is not in qualifierIds', () => {
    const r = validatePairingEdit(validMatch, 'unknown', 't2', qualifierIds, [])
    expect('error' in r).toBe(true)
  })

  it('returns error when awayId is not in qualifierIds', () => {
    const r = validatePairingEdit(validMatch, 't1', 'unknown', qualifierIds, [])
    expect('error' in r).toBe(true)
  })

  it('returns error when homeId is already in another first-round match', () => {
    const r = validatePairingEdit(validMatch, 't3', 't2', qualifierIds, ['t3', 't4'])
    expect(r).toEqual({ error: 'That team is already in another first-round match.' })
  })

  it('returns error when awayId is already in another first-round match', () => {
    const r = validatePairingEdit(validMatch, 't1', 't4', qualifierIds, ['t3', 't4'])
    expect(r).toEqual({ error: 'That team is already in another first-round match.' })
  })
})

describe('expectedBracketSize', () => {
  it('returns 2 for final', () => {
    expect(expectedBracketSize('final')).toBe(2)
  })

  it('returns 4 for semi', () => {
    expect(expectedBracketSize('semi')).toBe(4)
  })

  it('returns 8 for top_8', () => {
    expect(expectedBracketSize('top_8')).toBe(8)
  })

  it('returns 16 for top_16', () => {
    expect(expectedBracketSize('top_16')).toBe(16)
  })

  it('returns 32 for top_32', () => {
    expect(expectedBracketSize('top_32')).toBe(32)
  })

  it('returns null for null (legacy tournament)', () => {
    expect(expectedBracketSize(null)).toBeNull()
  })

  it('returns null for an unknown string', () => {
    expect(expectedBracketSize('top_64')).toBeNull()
  })
})
