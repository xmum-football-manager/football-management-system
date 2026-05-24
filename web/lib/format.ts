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
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}
