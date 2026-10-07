import { and, eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import {
  Block,
  Challenge,
  ChallengeAttempt,
  DailyGame,
  Entitlement,
  League,
  LeagueMember,
  PlayerProfile,
  Report,
  Run,
  RunSession,
  Streak,
  UserAchievement,
  XpLedger
} from '@/drizzle/schema'

function utcDayString(d: Date) {
  return d.toISOString().slice(0, 10)
}

function recomputeCurrent(dates: string[]) {
  const uniq = [...new Set(dates)].sort().reverse()
  if (uniq.length === 0) return { count: 0, last: null as string | null }
  const today = utcDayString(new Date())
  const yesterday = utcDayString(new Date(Date.now() - 86400000))
  let cursor = uniq[0] === today ? today : uniq[0] === yesterday ? yesterday : null
  if (!cursor) return { count: 0, last: uniq[0] }
  let count = 0
  for (const day of uniq) {
    if (day === cursor) {
      count += 1
      cursor = utcDayString(new Date(new Date(`${cursor}T00:00:00Z`).getTime() - 86400000))
    } else break
  }
  return { count, last: uniq[0] }
}

export async function migrateAnonymousData(anonUserId: string, newUserId: string) {
  if (!anonUserId || !newUserId || anonUserId === newUserId) return
  await db.transaction(async (tx) => {
    const anonProfile = await tx.select().from(PlayerProfile).where(eq(PlayerProfile.userId, anonUserId))
    const newProfile = await tx.select().from(PlayerProfile).where(eq(PlayerProfile.userId, newUserId))
    if (anonProfile.length > 0 && newProfile.length === 0) {
      await tx
        .update(PlayerProfile)
        .set({ userId: newUserId })
        .where(eq(PlayerProfile.userId, anonUserId))
    } else if (anonProfile.length > 0) {
      await tx.delete(PlayerProfile).where(eq(PlayerProfile.userId, anonUserId))
    }

    await tx.update(RunSession).set({ userId: newUserId }).where(eq(RunSession.userId, anonUserId))

    const anonRuns = await tx.select().from(Run).where(eq(Run.userId, anonUserId))
    for (const run of anonRuns) {
      try {
        await tx.update(Run).set({ userId: newUserId }).where(eq(Run.id, run.id))
      } catch {
        continue
      }
    }

    await tx
      .update(Challenge)
      .set({ creatorUserId: newUserId })
      .where(eq(Challenge.creatorUserId, anonUserId))

    const anonAttempts = await tx
      .select()
      .from(ChallengeAttempt)
      .where(eq(ChallengeAttempt.recipientUserId, anonUserId))
    for (const attempt of anonAttempts) {
      try {
        await tx
          .update(ChallengeAttempt)
          .set({ recipientUserId: newUserId })
          .where(eq(ChallengeAttempt.id, attempt.id))
      } catch {
        await tx.delete(ChallengeAttempt).where(eq(ChallengeAttempt.id, attempt.id))
      }
    }

    const anonXp = await tx.select().from(XpLedger).where(eq(XpLedger.userId, anonUserId))
    if (anonXp.length > 0) {
      await tx
        .insert(XpLedger)
        .values(
          anonXp.map((r) => ({ userId: newUserId, sourceKey: r.sourceKey, amount: r.amount, reason: r.reason }))
        )
        .onConflictDoNothing({ target: XpLedger.sourceKey })
      await tx.delete(XpLedger).where(eq(XpLedger.userId, anonUserId))
    }

    const anonAchievements = await tx
      .select()
      .from(UserAchievement)
      .where(eq(UserAchievement.userId, anonUserId))
    if (anonAchievements.length > 0) {
      await tx
        .insert(UserAchievement)
        .values(
          anonAchievements.map((r) => ({
            userId: newUserId,
            achievementId: r.achievementId,
            context: r.context
          }))
        )
        .onConflictDoNothing()
      await tx.delete(UserAchievement).where(eq(UserAchievement.userId, anonUserId))
    }

    await tx.update(League).set({ ownerUserId: newUserId }).where(eq(League.ownerUserId, anonUserId))

    const anonMemberships = await tx
      .select()
      .from(LeagueMember)
      .where(eq(LeagueMember.userId, anonUserId))
    if (anonMemberships.length > 0) {
      await tx
        .insert(LeagueMember)
        .values(anonMemberships.map((m) => ({ leagueId: m.leagueId, userId: newUserId, role: m.role })))
        .onConflictDoNothing()
      await tx.delete(LeagueMember).where(eq(LeagueMember.userId, anonUserId))
    }

    const anonEntitlement = await tx
      .select()
      .from(Entitlement)
      .where(eq(Entitlement.userId, anonUserId))
    const newEntitlement = await tx.select().from(Entitlement).where(eq(Entitlement.userId, newUserId))
    if (anonEntitlement.length > 0 && newEntitlement.length === 0) {
      await tx.update(Entitlement).set({ userId: newUserId }).where(eq(Entitlement.userId, anonUserId))
    } else if (anonEntitlement.length > 0) {
      await tx.delete(Entitlement).where(eq(Entitlement.userId, anonUserId))
    }

    await tx.update(Block).set({ blockerUserId: newUserId }).where(eq(Block.blockerUserId, anonUserId))
    await tx.update(Block).set({ blockedUserId: newUserId }).where(eq(Block.blockedUserId, anonUserId))
    await tx.update(Report).set({ reporterUserId: newUserId }).where(eq(Report.reporterUserId, anonUserId))

    const rankedDates = await tx
      .select({ gameDate: DailyGame.gameDate })
      .from(Run)
      .innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id))
      .where(and(eq(Run.userId, newUserId), eq(Run.mode, 'ranked'), eq(Run.valid, true)))
    const { count, last } = recomputeCurrent(rankedDates.map((r) => r.gameDate))
    const anonStreak = await tx.select().from(Streak).where(eq(Streak.userId, anonUserId))
    const newStreak = await tx.select().from(Streak).where(eq(Streak.userId, newUserId))
    const longest = Math.max(
      count,
      anonStreak[0]?.longestCount ?? 0,
      newStreak[0]?.longestCount ?? 0
    )
    const grace = Math.max(anonStreak[0]?.graceTokens ?? 0, newStreak[0]?.graceTokens ?? 0)
    const graceUsed = Math.max(anonStreak[0]?.graceUsedTotal ?? 0, newStreak[0]?.graceUsedTotal ?? 0)
    if (newStreak.length > 0) {
      await tx
        .update(Streak)
        .set({ currentCount: count, longestCount: longest, lastCompletedDate: last, graceTokens: grace, graceUsedTotal: graceUsed })
        .where(eq(Streak.userId, newUserId))
    } else {
      await tx.insert(Streak).values({
        userId: newUserId,
        currentCount: count,
        longestCount: longest,
        lastCompletedDate: last,
        graceTokens: grace,
        graceUsedTotal: graceUsed
      })
    }
    if (anonStreak.length > 0) await tx.delete(Streak).where(eq(Streak.userId, anonUserId))
  })
}
