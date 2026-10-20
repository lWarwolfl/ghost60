import { and, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/drizzle'
import { RunSession, type TRunSession } from '@/drizzle/schema'
import { getPlan, type TPlan } from '@/lib/game/entitlement'

export const FREE_RUNS_PER_DAY = 5

export function chargeSnapshot(sessions: TRunSession[], plan: TPlan, now = new Date()) {
  const start = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const end = new Date(start.getTime() + 86400000)
  const today = sessions.filter((s) => s.startedAt >= start && s.startedAt < end)
  const reserved = today.filter(
    (s) =>
      ['ranked', 'special'].includes(s.mode) &&
      !s.challengeId &&
      (s.consumedAt !== null || (s.state !== 'cancelled' && s.state !== 'expired' && s.expiresAt > now))
  )
  const used = reserved.length
  const limit = plan === 'ghost_plus' ? null : FREE_RUNS_PER_DAY
  const remaining = limit === null ? null : Math.max(0, limit - used)
  return {
    limit,
    remaining,
    used,
    resetAt: end.toISOString(),
    rankedAvailable: remaining === null || remaining > 0,
    resumableModes: [
      ...new Set(
        today
          .filter(
            (s) =>
              !s.consumedAt &&
              !['cancelled', 'expired', 'submitted'].includes(s.state) &&
              s.expiresAt > now
          )
          .map((s) => s.mode)
      )
    ],
    plan
  }
}

export async function getCharges(userId: string, reader: Pick<typeof db, 'select'> = db, now = new Date()) {
  const start = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const sessions = await reader.select().from(RunSession).where(and(
    eq(RunSession.userId, userId), gte(RunSession.startedAt, start),
    lt(RunSession.startedAt, new Date(start.getTime() + 86400000))
  ))
  return chargeSnapshot(sessions, await getPlan(userId, reader), now)
}
