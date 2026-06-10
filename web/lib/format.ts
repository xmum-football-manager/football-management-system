export function formatRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sameYear = s.getFullYear() === e.getFullYear()
  const sameMonth = sameYear && s.getMonth() === e.getMonth()
  const fmt = (d: Date, withMonth: boolean) =>
    withMonth
      ? d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
      : d.getDate().toString()

  if (sameMonth) {
    return `${fmt(s, false)}–${fmt(e, true)}${sameYear ? '' : ` ${e.getFullYear()}`}`
  }
  if (sameYear) {
    return `${fmt(s, true)} – ${fmt(e, true)}`
  }
  return `${s.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function formatMatchTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  })
}

export function formatClock(iso: string): string {
  if (!iso) return 'TBD'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function teamInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function matchElapsedSeconds(
  match: {
    match_started_at: string | null
    halftime_started_at: string | null
    second_half_started_at: string | null
  },
  now: Date,
): number {
  if (!match.match_started_at) return 0
  const start = new Date(match.match_started_at).getTime()
  if (!match.halftime_started_at) {
    return Math.floor((now.getTime() - start) / 1000)
  }
  const firstHalf = Math.floor(
    (new Date(match.halftime_started_at).getTime() - start) / 1000,
  )
  if (!match.second_half_started_at) {
    return firstHalf
  }
  const secondHalfElapsed = Math.floor(
    (now.getTime() - new Date(match.second_half_started_at).getTime()) / 1000,
  )
  return firstHalf + secondHalfElapsed
}

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function tournamentDayLabel(
  tournament: { start_date: string; end_date: string },
  matchTime: string,
): string {
  const start = new Date(tournament.start_date)
  const end = new Date(tournament.end_date)
  const match = new Date(matchTime)

  // Strip to local date-only (midnight) for day arithmetic
  const toDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const startDay = toDay(start)
  const endDay = toDay(end)
  const matchDay = toDay(match)

  const msPerDay = 1000 * 60 * 60 * 24
  const totalDays =
    Math.round((endDay.getTime() - startDay.getTime()) / msPerDay) + 1
  const dayIndex =
    Math.round((matchDay.getTime() - startDay.getTime()) / msPerDay) + 1

  const label = match.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })

  return `Day ${dayIndex} of ${totalDays} (${label})`
}

export function expectedMatchRange(
  tournament: {
    minutes_per_half: number
    halftime_enabled: boolean
    halftime_minutes: number | null
  },
  matchTime: string,
): string {
  const start = new Date(matchTime)
  const durationMinutes =
    2 * tournament.minutes_per_half +
    (tournament.halftime_enabled ? (tournament.halftime_minutes ?? 0) : 0)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return `${formatClock(start.toISOString())} – ${formatClock(end.toISOString())}`
}
