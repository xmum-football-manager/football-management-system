import { describe, it, expect } from 'vitest'
import { groupAssignmentIssues, groupCompleteness } from '@/lib/groups-complete'

const team = (id: string, name: string, group_label: string | null) => ({ id, name, group_label })

describe('groupAssignmentIssues', () => {
  it('returns empty array when all teams are assigned and groups are full', () => {
    const teams = [
      team('1', 'Alpha', 'A'), team('2', 'Bravo', 'A'),
      team('3', 'Charlie', 'B'), team('4', 'Delta', 'B'),
    ]
    expect(groupAssignmentIssues(teams, 2, 2)).toEqual([])
  })

  it('returns an assignment issue when a team has null label', () => {
    // numGroups=1, teamsPerGroup=2: Bravo is unassigned AND Group A only has 1 team.
    const teams = [
      team('1', 'Alpha', 'A'), team('2', 'Bravo', null),
    ]
    const issues = groupAssignmentIssues(teams, 1, 2)
    expect(issues.some(i => i.includes('Bravo'))).toBe(true)
    expect(issues.some(i => i.includes('not assigned to a group'))).toBe(true)
  })

  it('returns an assignment issue when a team has an invalid label', () => {
    // numGroups=1 means only 'A' is valid; 'B' is out of range.
    // Also produces a group-count issue for A (1 team, expected 2).
    const teams = [
      team('1', 'Alpha', 'A'), team('2', 'Bravo', 'B'),
    ]
    const issues = groupAssignmentIssues(teams, 1, 2)
    expect(issues.some(i => i.includes('Bravo'))).toBe(true)
    expect(issues.some(i => i.includes('not assigned to a group'))).toBe(true)
  })

  it('returns a group issue when a group is under-full', () => {
    const teams = [
      team('1', 'Alpha', 'A'), team('2', 'Bravo', 'A'),
      team('3', 'Charlie', 'B'),
    ]
    const issues = groupAssignmentIssues(teams, 2, 2)
    expect(issues.some(i => i.includes('Group B'))).toBe(true)
    expect(issues.some(i => i.includes('expected 2'))).toBe(true)
  })

  it('returns a group issue when a group is over-full', () => {
    const teams = [
      team('1', 'Alpha', 'A'), team('2', 'Bravo', 'A'), team('3', 'Charlie', 'A'),
      team('4', 'Delta', 'B'), team('5', 'Echo', 'B'),
    ]
    const issues = groupAssignmentIssues(teams, 2, 2)
    expect(issues.some(i => i.includes('Group A'))).toBe(true)
    expect(issues.some(i => i.includes('3 teams'))).toBe(true)
  })

  it('returns all issues when both assignment and group count problems exist', () => {
    const teams = [
      team('1', 'Alpha', 'A'),
      team('2', 'Bravo', null),
      // Group B has 0 teams (missing), Group A has 1 (expected 2)
    ]
    const issues = groupAssignmentIssues(teams, 2, 2)
    expect(issues.some(i => i.includes('not assigned to a group'))).toBe(true)
    expect(issues.some(i => i.includes('Group A') || i.includes('Group B'))).toBe(true)
  })

  it('returns empty array for exactly-full balanced groups', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'), team('3', 'T3', 'A'),
      team('4', 'T4', 'B'), team('5', 'T5', 'B'), team('6', 'T6', 'B'),
      team('7', 'T7', 'C'), team('8', 'T8', 'C'), team('9', 'T9', 'C'),
    ]
    expect(groupAssignmentIssues(teams, 3, 3)).toEqual([])
  })
})

describe('groupCompleteness', () => {
  it('returns allAssigned=true and allFull=true with empty issues when complete', () => {
    const teams = [
      team('1', 'T1', 'A'), team('2', 'T2', 'A'),
      team('3', 'T3', 'B'), team('4', 'T4', 'B'),
    ]
    const result = groupCompleteness(teams, 2, 2)
    expect(result.allAssigned).toBe(true)
    expect(result.allFull).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('returns allAssigned=false when a team has no label, and allFull=false when a group is short', () => {
    const teams = [
      team('1', 'Alpha', 'A'),
      team('2', 'Bravo', null),
      // Group B has 0 teams (expected 2), Group A has 1 (expected 2)
    ]
    const result = groupCompleteness(teams, 2, 2)
    expect(result.allAssigned).toBe(false)
    expect(result.allFull).toBe(false)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})
