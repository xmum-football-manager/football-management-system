import { describe, it, expect } from 'vitest'
import { groupStageComplete } from '@/lib/group-stage-gate'

type M = { phase: string | null; status: string }

const group = (status: string): M => ({ phase: 'group', status })
const ko = (status: string): M => ({ phase: 'knockout', status })

describe('groupStageComplete', () => {
  it('returns true when there are no group matches', () => {
    expect(groupStageComplete([ko('scheduled')])).toBe(true)
  })

  it('returns true when every group match is finished', () => {
    expect(groupStageComplete([group('finished'), group('finished')])).toBe(true)
  })

  it('returns false when any group match is not finished', () => {
    expect(groupStageComplete([group('finished'), group('scheduled')])).toBe(false)
  })

  // The exact bug: a fully-finished group stage gets one match reverted to
  // scheduled, after which a knockout match must NOT be allowed to kick off.
  it('returns false after a finished group match is reverted to scheduled', () => {
    const settled = [group('finished'), group('finished'), ko('scheduled')]
    expect(groupStageComplete(settled)).toBe(true)
    const reverted = [group('finished'), group('scheduled'), ko('scheduled')]
    expect(groupStageComplete(reverted)).toBe(false)
  })

  it('ignores live/finished knockout matches when judging the group stage', () => {
    expect(groupStageComplete([group('finished'), ko('live')])).toBe(true)
  })
})
