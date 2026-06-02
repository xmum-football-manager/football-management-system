import { describe, it, expect } from 'vitest'
import { buildBracketSkeleton, POWER_OF_TWO_SIZES } from '@/lib/bracket-skeleton'

describe('buildBracketSkeleton', () => {
  it('rejects pairing counts that are not a power-of-two bracket size', () => {
    // 3 pairings = 6 teams, not in {2,4,8,16,32}
    expect(() => buildBracketSkeleton([
      { home_team_id: 'a', away_team_id: 'b', match_time: null },
      { home_team_id: 'c', away_team_id: 'd', match_time: null },
      { home_team_id: 'e', away_team_id: 'f', match_time: null },
    ])).toThrow(/power of two/i)
  })

  it('builds round 1 with concrete teams and no feeders for a 4-team bracket', () => {
    const out = buildBracketSkeleton([
      { home_team_id: 'a', away_team_id: 'b', match_time: '2026-06-02T12:00:00Z' },
      { home_team_id: 'c', away_team_id: 'd', match_time: '2026-06-02T13:00:00Z' },
    ])
    // 2 pairings => round1 (sf, 2 matches) + final (1 match) = 3 nodes
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({
      knockout_round: 'sf', home_team_id: 'a', away_team_id: 'b',
      match_time: '2026-06-02T12:00:00Z',
      home_source_index: null, away_source_index: null,
    })
    expect(out[1]).toMatchObject({ knockout_round: 'sf', home_team_id: 'c', away_team_id: 'd' })
  })

  it('wires the final to its two feeder semifinals by index', () => {
    const out = buildBracketSkeleton([
      { home_team_id: 'a', away_team_id: 'b', match_time: null },
      { home_team_id: 'c', away_team_id: 'd', match_time: null },
    ])
    const final = out[2]
    expect(final).toMatchObject({
      knockout_round: 'final',
      home_team_id: null, away_team_id: null,
      match_time: null,
      home_source_index: 0, away_source_index: 1,
    })
  })

  it('builds all rounds with correct labels for an 8-team bracket', () => {
    const pairings = ['ab', 'cd', 'ef', 'gh'].map((p) => ({
      home_team_id: p[0], away_team_id: p[1], match_time: null,
    }))
    const out = buildBracketSkeleton(pairings)
    // qf(4) + sf(2) + final(1) = 7 nodes
    expect(out.map((n) => n.knockout_round)).toEqual([
      'qf', 'qf', 'qf', 'qf', 'sf', 'sf', 'final',
    ])
    // sf[0] (index 4) is fed by qf[0] and qf[1]
    expect(out[4]).toMatchObject({ home_source_index: 0, away_source_index: 1 })
    // sf[1] (index 5) is fed by qf[2] and qf[3]
    expect(out[5]).toMatchObject({ home_source_index: 2, away_source_index: 3 })
    // final (index 6) is fed by the two sfs
    expect(out[6]).toMatchObject({ home_source_index: 4, away_source_index: 5 })
  })

  it('exposes the allowed bracket sizes', () => {
    expect(POWER_OF_TWO_SIZES).toEqual([2, 4, 8, 16, 32])
  })
})
