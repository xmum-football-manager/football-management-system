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

// Match-clock label for a goal, e.g. 9'50". Null when the match clock is unknown
// (goal recorded before elapsed_seconds existed, or match never had a kickoff time).
export function formatGoalClock(seconds: number | null): string {
  if (seconds === null) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}'${String(s).padStart(2, '0')}"`
}

export function teamInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}
