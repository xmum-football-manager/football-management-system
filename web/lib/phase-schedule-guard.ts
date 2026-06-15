type ScheduleInput = { phase: string | null; match_time: string | null }

export function phaseSchedulingStatus(matches: ScheduleInput[]): {
  group: boolean
  knockout: boolean
} {
  const group = matches.filter((m) => m.phase === 'group')
  const knockout = matches.filter((m) => m.phase === 'knockout')
  return {
    group: group.length === 0 || group.every((m) => m.match_time !== null),
    knockout: knockout.length === 0 || knockout.every((m) => m.match_time !== null),
  }
}
