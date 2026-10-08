export const LEAGUE_SIZE_MAX = 12

export type TLeaguePlan = 'free' | 'ghost_plus'

export function getLeagueLimits(plan: string) {
  if (plan === 'ghost_plus') return { create: 5, join: 10, size: LEAGUE_SIZE_MAX }
  return { create: 1, join: 3, size: LEAGUE_SIZE_MAX }
}

function shiftDay(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Date(d.getTime() + delta * 86400000).toISOString().slice(0, 10)
}

export function weekRangeUTC(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dow = d.getUTCDay()
  const toMonday = (dow + 6) % 7
  const start = shiftDay(dateStr, -toMonday)
  const end = shiftDay(start, 6)
  return { start, end }
}

export function weekDatesUTC(dateStr: string) {
  const { start } = weekRangeUTC(dateStr)
  return Array.from({ length: 7 }, (_, i) => shiftDay(start, i))
}

export function percentilePoints(allScores: number[], userScore: number | null) {
  if (userScore === null || userScore === undefined) return 0
  const n = allScores.length
  if (n === 0) return 0
  if (n === 1) return 100
  let below = 0
  let equal = 0
  for (const s of allScores) {
    if (s < userScore) below += 1
    else if (s === userScore) equal += 1
  }
  if (equal === 0) {
    const rankBelow = allScores.filter((s) => s < userScore).length
    return Math.round(((rankBelow / n) * 100 + Number.EPSILON) * 100) / 100
  }
  const points = ((below + 0.5 * (equal - 1)) / (n - 1)) * 100
  return Math.round((points + Number.EPSILON) * 100) / 100
}

export function weeklyScore(dailyPoints: Array<number | null>) {
  const played = dailyPoints.filter((p) => p !== null && p !== undefined).length
  const values = dailyPoints.map((p) => (p === null || p === undefined ? 0 : p))
  values.sort((a, b) => b - a)
  const total = values.slice(0, 5).reduce((s, v) => s + v, 0)
  return { total: Math.round((total + Number.EPSILON) * 100) / 100, daysPlayed: played }
}

const RESERVED = new Set(['admin', 'ghost60', 'support', 'system', 'moderator'])

export function validateLeagueName(raw: unknown) {
  if (typeof raw !== 'string') return { ok: false as const, error: 'invalid-name' }
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { ok: false as const, error: 'invalid-name' }
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 3 || name.length > 40) return { ok: false as const, error: 'invalid-name' }
  if (RESERVED.has(name.toLowerCase())) return { ok: false as const, error: 'reserved-name' }
  return { ok: true as const, name }
}
