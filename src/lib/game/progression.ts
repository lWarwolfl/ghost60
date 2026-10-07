import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/drizzle'
import {
  Achievement,
  Challenge,
  ChallengeAttempt,
  DailyGame,
  Run,
  Streak,
  UserAchievement,
  XpLedger
} from '@/drizzle/schema'
import ACHIEVEMENTS from '../../../content/achievements.json'

export const XP = {
  RANKED_COMPLETION: 100,
  SHARE_FIRST_PER_DAY: 10,
  CHALLENGE_WIN: 20,
  CHALLENGE_WIN_DAILY_CAP: 100,
  PERSONAL_BEST: 25,
  STREAK_7: 150,
  LEAGUE_PARTICIPATION: 50
} as const

export function xpForLevel(level: number) {
  return Math.round(120 * Math.pow(level, 1.35))
}

export function levelForXp(total: number) {
  let level = 1
  let cumulative = 0
  while (true) {
    const need = xpForLevel(level)
    if (total < cumulative + need) return { level, intoLevel: total - cumulative, need }
    cumulative += need
    level += 1
  }
}

export type TStreakState = {
  currentCount: number
  longestCount: number
  lastCompletedDate: string | null
  graceTokens: number
  graceUsedTotal: number
}

function shiftDay(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Date(d.getTime() + delta * 86400000).toISOString().slice(0, 10)
}

export function streakTransition(state: TStreakState, today: string, maxGrace: number) {
  if (state.lastCompletedDate === today) return { ...state, changed: false }
  let current = 1
  let graceTokens = state.graceTokens
  let graceUsedTotal = state.graceUsedTotal
  if (state.lastCompletedDate === shiftDay(today, -1)) {
    current = state.currentCount + 1
  } else if (state.lastCompletedDate === shiftDay(today, -2) && graceTokens > 0) {
    current = state.currentCount + 1
    graceTokens -= 1
    graceUsedTotal += 1
  }
  const longestCount = Math.max(state.longestCount, current)
  if (current > 0 && current % 7 === 0 && graceTokens < maxGrace) graceTokens += 1
  return { currentCount: current, longestCount, lastCompletedDate: today, graceTokens, graceUsedTotal, changed: true }
}

export function remainingWinXp(todayWinXp: number) {
  return Math.max(0, XP.CHALLENGE_WIN_DAILY_CAP - todayWinXp)
}

export type TProgressionInput = {
  userId: string
  run: { id: string; mode: string; valid: boolean; validatedScore: number; dailyGameId: string }
  engineId: string
  gameDate: string
  outcome: string | null
  attemptId?: string
  sourceScore?: number
  isGhostPlus: boolean
}

export type TProgressionResult = {
  xpAwarded: number
  unlocked: string[]
  isPersonalBest: boolean
  streak: TStreakState | null
}

export async function applyProgression(input: TProgressionInput): Promise<TProgressionResult> {
  const { userId, run, engineId, gameDate, outcome } = input
  const empty: TProgressionResult = { xpAwarded: 0, unlocked: [], isPersonalBest: false, streak: null }
  if (!run.valid) return empty

  await db
    .insert(Achievement)
    .values(
      (ACHIEVEMENTS as Array<{ id: string; title: string; description: string }>).map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        iconKey: a.id,
        config: {}
      }))
    )
    .onConflictDoNothing()

  const xpRows: Array<{ userId: string; sourceKey: string; amount: number; reason: string }> = []
  const unlockIds = new Set<string>()
  let isPersonalBest = false
  let streak: TStreakState | null = null

  if (run.mode === 'ranked') {
    const peers = await db
      .select({ validatedScore: Run.validatedScore, id: Run.id })
      .from(Run)
      .innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id))
      .where(and(eq(Run.userId, userId), eq(DailyGame.gameId, engineId), eq(Run.valid, true)))
    const otherBest = peers.filter((r) => r.id !== run.id).map((r) => r.validatedScore)
    if (otherBest.length === 0 || run.validatedScore > Math.max(...otherBest)) {
      isPersonalBest = true
      xpRows.push({ userId, sourceKey: `pb:${run.id}`, amount: XP.PERSONAL_BEST, reason: 'personal_best' })
    }
    xpRows.push({ userId, sourceKey: `ranked:${userId}:${run.dailyGameId}`, amount: XP.RANKED_COMPLETION, reason: 'ranked_completion' })

    const streakRows = await db.select().from(Streak).where(eq(Streak.userId, userId))
    const current: TStreakState = streakRows[0]
      ? {
          currentCount: streakRows[0].currentCount,
          longestCount: streakRows[0].longestCount,
          lastCompletedDate: streakRows[0].lastCompletedDate,
          graceTokens: streakRows[0].graceTokens,
          graceUsedTotal: streakRows[0].graceUsedTotal
        }
      : { currentCount: 0, longestCount: 0, lastCompletedDate: null, graceTokens: 0, graceUsedTotal: 0 }
    const next = streakTransition(current, gameDate, input.isGhostPlus ? 2 : 1)
    streak = next
    if (next.changed) {
      if (streakRows[0]) {
        await db
          .update(Streak)
          .set({
            currentCount: next.currentCount,
            longestCount: next.longestCount,
            lastCompletedDate: next.lastCompletedDate,
            graceTokens: next.graceTokens,
            graceUsedTotal: next.graceUsedTotal
          })
          .where(eq(Streak.userId, userId))
      } else {
        await db.insert(Streak).values({
          userId,
          currentCount: next.currentCount,
          longestCount: next.longestCount,
          lastCompletedDate: next.lastCompletedDate,
          graceTokens: next.graceTokens,
          graceUsedTotal: next.graceUsedTotal
        })
      }
      if (next.currentCount > 0 && next.currentCount % 7 === 0) {
        xpRows.push({ userId, sourceKey: `streak7:${userId}:${gameDate}`, amount: XP.STREAK_7, reason: 'streak_7' })
      }
    }
    if (next.currentCount >= 7) unlockIds.add('seven_signals')
    if (next.currentCount >= 30) unlockIds.add('thirty_signals')

    const engines = await db
      .select({ gameId: DailyGame.gameId })
      .from(Run)
      .innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id))
      .where(and(eq(Run.userId, userId), eq(Run.valid, true)))
    if (new Set(engines.map((e) => e.gameId)).size >= 6) unlockIds.add('six_senses')

    if (run.mode === 'ranked') unlockIds.add('first_trace')
  }

  if (run.mode === 'challenge' && outcome && outcome !== 'invalid') {
    unlockIds.add('echo_found')
    if (outcome === 'win' && input.attemptId) {
      const dayStart = new Date(`${gameDate}T00:00:00Z`)
      const wins = await db
        .select({ amount: XpLedger.amount, createdAt: XpLedger.createdAt })
        .from(XpLedger)
        .where(and(eq(XpLedger.userId, userId), eq(XpLedger.reason, 'challenge_win')))
      const todayTotal = wins.filter((w) => w.createdAt >= dayStart).reduce((s, w) => s + w.amount, 0)
      const grant = Math.min(XP.CHALLENGE_WIN, remainingWinXp(todayTotal))
      if (grant > 0) {
        xpRows.push({ userId, sourceKey: `win:${input.attemptId}`, amount: grant, reason: 'challenge_win' })
      }
      if (input.sourceScore !== undefined && input.sourceScore > 0) {
        const margin = (run.validatedScore - input.sourceScore) / input.sourceScore
        if (margin > 0 && margin < 0.01) unlockIds.add('photo_finish')
      }
      const attempts = await db
        .select({ createdAt: ChallengeAttempt.createdAt, outcome: ChallengeAttempt.outcome })
        .from(ChallengeAttempt)
        .where(eq(ChallengeAttempt.recipientUserId, userId))
      const todayWins = attempts.filter((a) => a.outcome === 'win' && a.createdAt >= dayStart).length
      if (todayWins >= 5) unlockIds.add('clean_sweep')
    }
    const mine = await db.select({ id: Challenge.id }).from(Challenge).where(eq(Challenge.creatorUserId, userId))
    if (mine.length > 0) {
      const raced = await db
        .select({ challengeId: ChallengeAttempt.challengeId })
        .from(ChallengeAttempt)
        .where(
          inArray(
            ChallengeAttempt.challengeId,
            mine.map((m) => m.id)
          )
        )
      if (new Set(raced.map((r) => r.challengeId)).size >= 5) unlockIds.add('haunter')
    }
  }

  if (run.mode === 'past_self') {
    const peers = await db
      .select({ validatedScore: Run.validatedScore, mode: Run.mode })
      .from(Run)
      .innerJoin(DailyGame, eq(Run.dailyGameId, DailyGame.id))
      .where(and(eq(Run.userId, userId), eq(DailyGame.gameId, engineId), eq(Run.valid, true)))
    const others = peers.filter((r) => r.mode !== 'past_self').map((r) => r.validatedScore)
    if (others.length > 0 && run.validatedScore > Math.max(...others)) unlockIds.add('personal_haunting')
  }

  if (xpRows.length > 0) {
    const granted = await db.insert(XpLedger).values(xpRows).onConflictDoNothing({ target: XpLedger.sourceKey }).returning()
    empty.xpAwarded = granted.reduce((s, r) => s + r.amount, 0)
  }
  if (unlockIds.size > 0) {
    const fresh = await db
      .insert(UserAchievement)
      .values([...unlockIds].map((achievementId) => ({ userId, achievementId, context: {} })))
      .onConflictDoNothing()
      .returning()
    empty.unlocked = fresh.map((r) => r.achievementId)
  }
  empty.isPersonalBest = isPersonalBest
  empty.streak = streak
  return empty
}
