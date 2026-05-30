import { describe, it, expect } from 'vitest'
import { checkTournamentReadiness } from '@/lib/tournament-readiness'

const team = (id: string, name: string, group_label: string | null) => ({ id, name, group_label })

describe('checkTournamentReadiness — allGroupsFull', () => {
  it('is true when teams_per_group is null (no size constraint)', () => {
    const teams = [team('1', 'A', 'A'), team('2', 'B', 'A')]
    const counts = { '1': 5, '2': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 1, null)
    expect(r.allGroupsFull).toBe(true)
  })

  it('is true when every group has exactly teamsPerGroup teams', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'),
      team('3', 'T3', 'B'), team('4', 'T4', 'B'),
    ]
    const counts = { '1': 5, '2': 5, '3': 5, '4': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allGroupsFull).toBe(true)
    expect(r.canGenerateFixtures).toBe(true)
  })

  it('is false when a group has fewer than teamsPerGroup teams', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'),
      team('3', 'T3', 'B'),
    ]
    const counts = { '1': 5, '2': 5, '3': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allGroupsFull).toBe(false)
    expect(r.canGenerateFixtures).toBe(false)
    expect(r.blockingIssues.some(i => i.includes('Group B'))).toBe(true)
  })

  it('is false when a group has more than teamsPerGroup teams', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'), team('3', 'T3', 'A'),
      team('4', 'T4', 'B'), team('5', 'T5', 'B'),
    ]
    const counts = { '1': 5, '2': 5, '3': 5, '4': 5, '5': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allGroupsFull).toBe(false)
  })

  it('is true for non-group formats regardless of group_label', () => {
    const teams = [team('1', 'T1', null), team('2', 'T2', null)]
    const counts = { '1': 5, '2': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin', null, null)
    expect(r.allGroupsFull).toBe(true)
  })

  it('blocks canGenerateFixtures when players ready but groups not full', () => {
    const teams = [team('1', 'T1', 'A')]
    const counts = { '1': 5 }
    const r = checkTournamentReadiness(teams, counts, 5, 'round_robin_knockout', 2, 2)
    expect(r.allPlayersReady).toBe(true)
    expect(r.allGroupsFull).toBe(false)
    expect(r.canGenerateFixtures).toBe(false)
  })
})
