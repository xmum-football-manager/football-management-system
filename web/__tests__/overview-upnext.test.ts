import { describe, it, expect } from 'vitest'

function pickUpNext(
  matches: Array<{ status: string; match_time: string | null; phase: string }>,
) {
  const timedUpNext = matches
    .filter((m) => m.status === 'scheduled' && m.match_time !== null)
    .sort((a, b) => a.match_time!.localeCompare(b.match_time!))
    .at(0) ?? null

  return (
    timedUpNext ??
    matches.find((m) => m.status === 'scheduled' && m.phase === 'knockout') ??
    null
  )
}

const sched = (match_time: string | null, phase = 'group') =>
  ({ status: 'scheduled', match_time, phase })
const finished = (phase = 'group') =>
  ({ status: 'finished', match_time: '2026-06-01T10:00:00Z', phase })

describe('pickUpNext', () => {
  it('returns null when no scheduled matches exist', () => {
    expect(pickUpNext([])).toBeNull()
    expect(pickUpNext([finished()])).toBeNull()
  })

  it('returns the earliest timed match when one exists', () => {
    const matches = [
      sched('2026-06-07T15:00:00Z'),
      sched('2026-06-07T12:00:00Z'),
    ]
    const result = pickUpNext(matches)
    expect(result?.match_time).toBe('2026-06-07T12:00:00Z')
  })

  it('ignores finished matches even if timed', () => {
    const matches = [finished(), sched('2026-06-07T15:00:00Z')]
    expect(pickUpNext(matches)?.match_time).toBe('2026-06-07T15:00:00Z')
  })

  it('falls back to knockout match when no timed matches exist', () => {
    const ko = sched(null, 'knockout')
    expect(pickUpNext([ko])).toBe(ko)
  })

  it('prefers timed group match over untimed knockout match', () => {
    const group = sched('2026-06-07T15:00:00Z', 'group')
    const ko = sched(null, 'knockout')
    expect(pickUpNext([ko, group])).toBe(group)
  })

  it('returns null when only non-knockout untimed scheduled matches exist', () => {
    const untimed = sched(null, 'group')
    expect(pickUpNext([untimed])).toBeNull()
  })

  it('returns the knockout match when all group matches are finished', () => {
    const matches = [finished('group'), finished('group'), sched(null, 'knockout')]
    const result = pickUpNext(matches)
    expect(result?.phase).toBe('knockout')
  })

  it('picks knockout match with time over knockout match without time', () => {
    const ko1 = sched(null, 'knockout')
    const ko2 = sched('2026-06-07T15:00:00Z', 'knockout')
    expect(pickUpNext([ko1, ko2])).toBe(ko2)
  })

  it('sorts multiple timed knockout matches by earliest time', () => {
    // Both have times → handled by timedUpNext (sorted), not the find() fallback
    const ko1 = sched('2026-06-10T15:00:00Z', 'knockout')
    const ko2 = sched('2026-06-05T15:00:00Z', 'knockout')
    expect(pickUpNext([ko1, ko2])?.match_time).toBe('2026-06-05T15:00:00Z')
  })
})
