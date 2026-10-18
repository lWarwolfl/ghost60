import { and, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/drizzle'
import { RunSession, type TRunSession } from '@/drizzle/schema'
import { getPlan, type TPlan } from '@/lib/game/entitlement'

export function chargeSnapshot(sessions: TRunSession[], plan: TPlan, now = new Date()) {
  const start = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  const end = new Date(start.getTime() + 86400000)
  const today = sessions.filter((s) => s.startedAt >= start && s.startedAt < end)
  const reserved = today.filter((s) => ['ranked', 'practice', 'past_self'].includes(s.mode) && !s.challengeId &&
    (s.consumedAt !== null || (s.state !== 'cancelled' && s.state !== 'expired' && s.expiresAt > now)))
  const used = reserved.length
  const limit = plan === 'ghost_plus' ? null : 5
  return {
    limit, remaining: limit === null ? null : Math.max(0, limit - used), used,
    resetAt: end.toISOString(),
    rankedAvailable: !today.some((s) => s.mode === 'ranked' && (s.consumedAt !== null || s.state === 'submitted')), plan
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
