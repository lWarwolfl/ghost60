import { and, asc, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import {
  Account,
  Block,
  Challenge,
  ChallengeAttempt,
  Entitlement,
  League,
  LeagueMember,
  PlayerProfile,
  ProductEvent,
  Report,
  Run,
  RunSession,
  Session,
  Streak,
  User,
  UserAchievement,
  XpLedger,
} from '@/drizzle/schema'
import { getCurrentUser } from '@/lib/auth/server'
import { cancelSubscription } from '@/lib/billing/stripe'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'

export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await checkRateLimit('account-delete', user.id, RATE_LIMITS.accountDelete))) {
    return rateLimitedResponse()
  }
  const uid = user.id
  const [entitlement] = await db.select().from(Entitlement).where(eq(Entitlement.userId, uid))
  if (entitlement?.provider === 'stripe' && entitlement.providerSubscriptionId) {
    try {
      await cancelSubscription(entitlement.providerSubscriptionId)
    } catch {
      return NextResponse.json({ error: 'subscription-cancel-failed' }, { status: 503 })
    }
  }

  await db.transaction(async (tx) => {
    const myChallenges = await tx
      .select({ id: Challenge.id })
      .from(Challenge)
      .where(eq(Challenge.creatorUserId, uid))
    const myChallengeIds = myChallenges.map((c) => c.id)
    const myRuns = await tx.select({ id: Run.id }).from(Run).where(eq(Run.userId, uid))
    const myRunIds = myRuns.map((r) => r.id)

    if (myChallengeIds.length > 0) {
      await tx.delete(ChallengeAttempt).where(inArray(ChallengeAttempt.challengeId, myChallengeIds))
      await tx.delete(Challenge).where(eq(Challenge.creatorUserId, uid))
    }
    if (myRunIds.length > 0) {
      await tx.delete(ChallengeAttempt).where(inArray(ChallengeAttempt.runId, myRunIds))
      await tx.delete(Run).where(eq(Run.userId, uid))
    }
    await tx.delete(ChallengeAttempt).where(eq(ChallengeAttempt.recipientUserId, uid))
    await tx.delete(RunSession).where(eq(RunSession.userId, uid))

    const owned = await tx.select().from(League).where(eq(League.ownerUserId, uid))
    for (const league of owned) {
      const others = await tx
        .select()
        .from(LeagueMember)
        .where(eq(LeagueMember.leagueId, league.id))
        .orderBy(asc(LeagueMember.joinedAt))
      const next = others.find((m) => m.userId !== uid)
      if (!next) {
        await tx.delete(LeagueMember).where(eq(LeagueMember.leagueId, league.id))
        await tx.update(League).set({ archivedAt: new Date() }).where(eq(League.id, league.id))
      } else {
        await tx.update(League).set({ ownerUserId: next.userId }).where(eq(League.id, league.id))
        await tx
          .update(LeagueMember)
          .set({ role: 'owner' })
          .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, next.userId)))
        await tx
          .delete(LeagueMember)
          .where(and(eq(LeagueMember.leagueId, league.id), eq(LeagueMember.userId, uid)))
      }
    }
    await tx.delete(LeagueMember).where(eq(LeagueMember.userId, uid))

    await tx.delete(XpLedger).where(eq(XpLedger.userId, uid))
    await tx.delete(Streak).where(eq(Streak.userId, uid))
    await tx.delete(UserAchievement).where(eq(UserAchievement.userId, uid))
    await tx.delete(Entitlement).where(eq(Entitlement.userId, uid))
    await tx.delete(PlayerProfile).where(eq(PlayerProfile.userId, uid))
    await tx.delete(Block).where(or(eq(Block.blockerUserId, uid), eq(Block.blockedUserId, uid)))
    await tx.delete(Report).where(eq(Report.reporterUserId, uid))
    await tx.delete(ProductEvent).where(eq(ProductEvent.userId, uid))

    await tx.delete(Session).where(eq(Session.userId, uid))
    await tx.delete(Account).where(eq(Account.userId, uid))
    await tx.delete(User).where(eq(User.id, uid))
  })

  return NextResponse.json({ deleted: true })
}
