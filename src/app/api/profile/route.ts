import { desc, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import {
  Challenge,
  ChallengeAttempt,
  DailyGame,
  LeagueMember,
  PlayerProfile,
  Run,
  Streak,
  UserAchievement,
  XpLedger
} from '@/drizzle/schema'
import achievementCatalog from '../../../../content/achievements.json'
import { getCurrentUser } from '@/lib/auth/server'
import { getPlan } from '@/lib/game/entitlement'
import { levelForXp } from '@/lib/game/progression'
import { canEquip, loadSkinCatalog, resolveSkin } from '@/lib/game/skins'

function shiftDay(dateStr: string, delta: number) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + delta * 86400000).toISOString().slice(0, 10)
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const plan = await getPlan(user.id)
  const profiles = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, user.id))
  const streaks = await db.select().from(Streak).where(eq(Streak.userId, user.id))
  const ledger = await db.select({ amount: XpLedger.amount }).from(XpLedger).where(eq(XpLedger.userId, user.id))
  const xpTotal = ledger.reduce((s, r) => s + r.amount, 0)
  const owned = await db.select().from(UserAchievement).where(eq(UserAchievement.userId, user.id))
  const attempts = await db
    .select({ challengeId: ChallengeAttempt.challengeId, outcome: ChallengeAttempt.outcome, createdAt: ChallengeAttempt.createdAt })
    .from(ChallengeAttempt)
    .where(eq(ChallengeAttempt.recipientUserId, user.id))
  const sent = await db.select({ id: Challenge.id }).from(Challenge).where(eq(Challenge.creatorUserId, user.id))
  const memberships = await db.select({ leagueId: LeagueMember.leagueId }).from(LeagueMember).where(eq(LeagueMember.userId, user.id))
  const runs = await db
    .select()
    .from(Run)
    .where(eq(Run.userId, user.id))
    .orderBy(desc(Run.createdAt))
    .limit(30)
  const games =
    runs.length > 0
      ? await db
          .select()
          .from(DailyGame)
          .where(
            inArray(
              DailyGame.id,
              runs.map((r) => r.dailyGameId)
            )
          )
      : []
  const gameById = new Map(games.map((g) => [g.id, g]))
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = shiftDay(today, -6)
  const visibleRuns =
    plan === 'ghost_plus'
      ? runs
      : runs.filter((r) => {
          const date = gameById.get(r.dailyGameId)?.gameDate ?? null
          return date !== null && date >= weekStart
        })
  const catalog = loadSkinCatalog()
  const ownedIds = new Set(owned.map((o) => o.achievementId))
  const sentIds = new Set(sent.map((challenge) => challenge.id))
  const sentCompleted = attempts.filter((attempt) => sentIds.has(attempt.challengeId)).length
  const winsByDay = new Map<string, number>()
  for (const attempt of attempts) {
    if (attempt.outcome !== 'win') continue
    const day = attempt.createdAt.toISOString().slice(0, 10)
    winsByDay.set(day, (winsByDay.get(day) ?? 0) + 1)
  }
  const engines = new Set(
    runs.filter((run) => run.valid).map((run) => gameById.get(run.dailyGameId)?.gameId).filter(Boolean)
  )
  const validRuns = runs.filter((run) => run.valid).length
  const metricValue = (metric: string) => {
    switch (metric) {
      case 'validRuns':
        return validRuns
      case 'engines':
        return engines.size
      case 'streak':
        return streaks[0]?.currentCount ?? 0
      case 'challengesReceived':
        return attempts.length
      case 'challengesSentCompleted':
        return sentCompleted
      case 'challengeWinsInDay':
        return Math.max(0, ...winsByDay.values())
      case 'leagueRounds':
        return memberships.length > 0 ? 1 : 0
      case 'photoFinish':
      case 'pastSelfWins':
        return ownedIds.has(metric === 'photoFinish' ? 'photo_finish' : 'personal_haunting') ? 1 : 0
      default:
        return 0
    }
  }
  return NextResponse.json({
    plan,
    profile: profiles[0] ? { ...profiles[0], activeGhostSkin: resolveSkin(profiles[0].activeGhostSkin, plan).id, activeCardSkin: resolveSkin(profiles[0].activeCardSkin, plan).id } : null,
    streak: streaks[0] ?? null,
    xpTotal,
    level: levelForXp(xpTotal),
    history: { locked: plan !== 'ghost_plus', days: 7 },
    cosmetics: {
      equipped: {
        ghost: resolveSkin(profiles[0]?.activeGhostSkin, plan).id,
        card: resolveSkin(profiles[0]?.activeCardSkin, plan).id
      },
      catalog: catalog.skins.map((s) => ({ ...s, unlocked: canEquip(plan, s.id), gradient: s.avatar.gradient }))
    },
    achievements: achievementCatalog.map((achievement) => ({
      achievementId: achievement.id,
      unlocked: ownedIds.has(achievement.id),
      progress: Math.min(achievement.target, metricValue(achievement.metric)),
      target: achievement.target,
      detail: {
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon
      }
    })),
    recentRuns: visibleRuns.map((r) => ({
      id: r.id,
      mode: r.mode,
      validatedScore: r.validatedScore,
      valid: r.valid,
      gameDate: gameById.get(r.dailyGameId)?.gameDate ?? null,
      gameId: gameById.get(r.dailyGameId)?.gameId ?? null,
      title: gameById.get(r.dailyGameId)?.title ?? null
    }))
  })
}
