export function computeEndTime(
  startTime: string,
  minutesPerHalf: number,
  halftimeEnabled: boolean,
  halftimeMinutes: number | null,
): string {
  const [h, m] = startTime.split(':').map(Number)
  const duration = 2 * minutesPerHalf + (halftimeEnabled ? (halftimeMinutes ?? 0) : 0)
  const totalMinutes = (h * 60 + m + duration) % (24 * 60)
  const endH = Math.floor(totalMinutes / 60)
  const endM = totalMinutes % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
}

export function getTournamentDays(
  startDate: string,
  endDate: string,
): Array<{ label: string; date: string }> {
  const days: Array<{ label: string; date: string }> = []
  const current = new Date(startDate + 'T00:00:00Z')
  const end = new Date(endDate + 'T00:00:00Z')
  let dayNumber = 1
  while (current <= end) {
    const isoDate = current.toISOString().split('T')[0]
    const day = current.getUTCDate()
    const month = current.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
    days.push({ label: `Day ${dayNumber} (${day} ${month})`, date: isoDate })
    current.setUTCDate(current.getUTCDate() + 1)
    dayNumber++
  }
  return days
}
