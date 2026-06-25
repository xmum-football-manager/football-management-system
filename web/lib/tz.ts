// Single source of truth for time zone handling.
//
// This app runs tournaments in Malaysia, which observes a fixed UTC+8 offset
// year-round (no daylight saving). Every `match_time` (and other timestamps) is
// stored as a UTC instant in Postgres; we always *display* and *interpret admin
// input* in Malaysia time so a match never shows a different day/time depending
// on whether the code runs on the server (UTC) or in the browser.

export const MY_TZ = 'Asia/Kuala_Lumpur'
export const MY_OFFSET = '+08:00'

/** Calendar date (YYYY-MM-DD) of an instant, in Malaysia time. */
export function malaysiaDate(iso: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: MY_TZ })
}

/**
 * Convert an admin-entered date + time (Malaysia wall-clock) into a UTC instant
 * (ISO string). `date` is "YYYY-MM-DD", `time` is "HH:mm".
 */
export function malaysiaDateTimeToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00${MY_OFFSET}`).toISOString()
}

/**
 * Convert a `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", which the
 * admin picks as Malaysia wall-clock) into a UTC instant (ISO string).
 */
export function malaysiaInputToISO(local: string): string {
  const withSeconds = local.length === 16 ? `${local}:00` : local
  return new Date(`${withSeconds}${MY_OFFSET}`).toISOString()
}

/**
 * Pre-fill a `<input type="datetime-local">` from a stored instant, rendering it
 * in Malaysia time so the admin edits the same wall-clock they see elsewhere.
 */
export function isoToMalaysiaInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-CA', { timeZone: MY_TZ })
  const time = d.toLocaleTimeString('en-GB', { timeZone: MY_TZ, hour: '2-digit', minute: '2-digit' })
  return `${date}T${time}`
}

/** 1-based tournament day number for a Malaysia calendar date (YYYY-MM-DD). */
export function tournamentDayFromDate(date: string, startDate: string): number {
  const a = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`)
  return Math.max(0, Math.round((a - b) / 86_400_000)) + 1
}

/** 1-based tournament day number for a match instant, relative to the start date. */
export function tournamentDay(matchIso: string, startDate: string): number {
  return tournamentDayFromDate(malaysiaDate(matchIso), startDate)
}
