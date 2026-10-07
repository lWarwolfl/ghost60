import type { GameInputEvent } from '@/games/core/game-module'

export const COORD_MAX = 10000

export function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n)
}

export function isValidPoint(p: unknown): boolean {
  if (typeof p !== 'object' || p === null) return false
  const q = p as Record<string, unknown>
  return (
    isInt(q.x) &&
    isInt(q.y) &&
    (q.x as number) >= 0 &&
    (q.x as number) <= COORD_MAX &&
    (q.y as number) >= 0 &&
    (q.y as number) <= COORD_MAX
  )
}

export type ValidateEventsOptions = {
  maxEvents: number
  durationMs: number
  allowedTypes: ReadonlyArray<GameInputEvent['type']>
}

export function validateEvents(
  events: unknown,
  opts: ValidateEventsOptions
): { valid: boolean; invalidReason?: string } {
  if (!Array.isArray(events)) return { valid: false, invalidReason: 'events-not-array' }
  if (events.length > opts.maxEvents) return { valid: false, invalidReason: 'too-many-events' }
  let prevT = -1
  for (let i = 0; i < events.length; i += 1) {
    const e = events[i] as Record<string, unknown>
    if (typeof e !== 'object' || e === null) return { valid: false, invalidReason: `event-${i}-malformed` }
    if (!isInt(e.t) || (e.t as number) < 0 || (e.t as number) > opts.durationMs)
      return { valid: false, invalidReason: `event-${i}-bad-t` }
    if ((e.t as number) < prevT) return { valid: false, invalidReason: 'events-non-monotonic' }
    prevT = e.t as number
    if (typeof e.type !== 'string' || !opts.allowedTypes.includes(e.type as GameInputEvent['type']))
      return { valid: false, invalidReason: `event-${i}-bad-type` }
    if (e.type === 'tap' || e.type === 'pointer_down' || e.type === 'pointer_move' || e.type === 'pointer_up') {
      const p = (e as { p?: unknown }).p
      if (e.type !== 'tap' && !isValidPoint(p)) return { valid: false, invalidReason: `event-${i}-bad-point` }
      if (e.type === 'tap' && p !== undefined && !isValidPoint(p))
        return { valid: false, invalidReason: `event-${i}-bad-point` }
    }
    if (e.type === 'choice' || e.type === 'tap') {
      const v = (e as { value?: unknown }).value
      if (v !== undefined && !isInt(v)) return { valid: false, invalidReason: `event-${i}-bad-value` }
    }
  }
  return { valid: true }
}
