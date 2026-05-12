export function statusBadge(status: string) {
  if (status === 'active') return {
    bg: 'rgba(163,230,53,0.12)',
    border: 'rgba(163,230,53,0.45)',
    color: 'var(--brand-lime)',
    label: 'Active',
  }
  if (status === 'setup') return {
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.4)',
    color: '#7DD3FC',
    label: 'Setup',
  }
  return {
    bg: 'var(--ink-800)',
    border: 'var(--ink-700)',
    color: 'var(--ink-300)',
    label: 'Finished',
  }
}

export function statusRail(status: string) {
  if (status === 'active') return 'var(--brand-lime)'
  if (status === 'setup') return '#7DD3FC'
  return 'var(--ink-600)'
}

export function formatDateRange(start: string, end: string | null) {
  const s = new Date(start).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
  if (!end) return s
  const e = new Date(end).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${s} – ${e}`
}

export function formatLabel(fmt: string) {
  if (fmt === 'knockout') return 'Knockout'
  if (fmt === 'round_robin_knockout') return 'Round Robin + Knockout'
  return 'Round Robin'
}
