// Deterministic team visuals — no colors/codes in the DB, so derive them.

// Jersey palette from the design system (white/black dropped: invisible on dark pitch bg)
const JERSEY_COLORS = [
  '#DC2626', // red
  '#2563EB', // blue
  '#F59E0B', // amber
  '#7C3AED', // purple
  '#0891B2', // cyan
  '#DB2777', // pink
  '#16A34A', // green
  '#EA580C', // orange
]

/** Stable color for a team, hashed from its id. */
export function teamColor(teamId: string): string {
  let h = 0
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) >>> 0
  return JERSEY_COLORS[h % JERSEY_COLORS.length]
}

/** Short crest code: initials of up to 3 words, or first 3 letters of a single word. */
export function teamCode(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return words.map(w => w[0]).slice(0, 3).join('').toUpperCase()
  return name.trim().slice(0, 3).toUpperCase()
}
