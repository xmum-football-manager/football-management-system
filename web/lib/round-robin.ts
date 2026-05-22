/**
 * Round-robin schedule generator using the circle method.
 * Returns an array of "rounds"; each round is an array of {home,away} pairings.
 * Every team plays every other team exactly once.
 */
export function generateRoundRobin<T>(teams: T[]): { home: T; away: T }[][] {
  if (teams.length < 2) return []
  const list = [...teams]
  const bye = '__BYE__' as unknown as T
  if (list.length % 2 === 1) list.push(bye)

  const n = list.length
  const rounds: { home: T; away: T }[][] = []
  const fixed = list[0]
  const rotating = list.slice(1)

  for (let r = 0; r < n - 1; r++) {
    const round: { home: T; away: T }[] = []
    const ordered = [fixed, ...rotating]
    for (let i = 0; i < n / 2; i++) {
      const home = ordered[i]
      const away = ordered[n - 1 - i]
      if (home === bye || away === bye) continue
      // Alternate home/away across rounds for fairness
      if (r % 2 === 0) round.push({ home, away })
      else round.push({ home: away, away: home })
    }
    rounds.push(round)
    rotating.unshift(rotating.pop()!)
  }
  return rounds
}
