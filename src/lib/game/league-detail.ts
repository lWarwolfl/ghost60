import { and, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/drizzle'
import {
  Challenge,
  ChallengeAttempt,
  DailyGame,
  LeagueMember,
  PlayerProfile,
  Run,
  Streak,
  XpLedger
} from '@/drizzle/schema'
import { XP } from '@/lib/game/progression'
import { percentilePoints, weekDatesUTC, weekRangeUTC, weeklyScore } from '@/lib/game/leagues'
import { utcDayString } from '@/lib/game/daily'

export type TLeagueRow = {
  handle: string
  displayName: string | null
  avatarKey: string
  role: string
  isOwner: boolean
  total: number
  daysPlayed: number
  todayCompleted: boolean
  streak: number
  dailyPoints: number[]
  latestRivalry: { outcome: string; at: string } | null
}

export async function buildLeagueStandings(leagueId: string, ownerUserId: string, viewerUserId: string) {
  const today = utcDayString()
  const { start, end } = weekRangeUTC(today)
  const dates = weekDatesUTC(today)

  const members = await db.select().from(LeagueMember).where(eq(LeagueMember.leagueId, leagueId))
  const memberIds = members.map((m) => m.userId)
  const memberById = new Map(members.map((m) => [m.userId, m]))

  const games =
    memberIds.length > 0
      ? await db
          .select()
          .from(DailyGame)
          .where(and(gte(DailyGame.gameDate, start), lte(DailyGame.gameDate, end)))
      : []
  const gameByDate = new Map(games.map((g) => [g.gameDate, g]))
  const gameIds = games.map((g) => g.id)

  const globalRuns =
    gameIds.length > 0
      ? await db
          .select({ dailyGameId: Run.dailyGameId, userId: Run.userId, validatedScore: Run.validatedScore })
          .from(Run)
          .where(and(inArray(Run.dailyGameId, gameIds), eq(Run.mode, 'ranked'), eq(Run.valid, true)))
      : []
  const scoresByGame = new Map<string, number[]>()
  const scoreByGameUser = new Map<string, number>()
  for (const r of globalRuns) {
    const arr = scoresByGame.get(r.dailyGameId) ?? []
    arr.push(r.validatedScore)
    scoresByGame.set(r.dailyGameId, arr)
    scoreByGameUser.set(`${r.dailyGameId}:${r.userId}`, r.validatedScore)
  }

  const profiles =
    memberIds.length > 0
      ? await db.select().from(PlayerProfile).where(inArray(PlayerProfile.userId, memberIds))
      : []
  const profileById = new Map(profiles.map((p) => [p.userId, p]))
  const streaks =
    memberIds.length > 0
      ? await db.select().from(Streak).where(inArray(Streak.userId, memberIds))
      : []
  const streakById = new Map(streaks.map((s) => [s.userId, s]))

  const todayGame = gameByDate.get(today)
  const todaySet = new Set(
    todayGame ? globalRuns.filter((r) => r.dailyGameId === todayGame.id).map((r) => r.userId) : []
  )

  const memberIdSet = new Set(memberIds)
  const myChallenges =
    memberIds.length > 0
      ? await db.select({ id: Challenge.id, creatorUserId: Challenge.creatorUserId }).from(Challenge).where(inArray(Challenge.creatorUserId, memberIds))
      : []
  const challengeCreatorById = new Map(myChallenges.map((c) => [c.id, c.creatorUserId]))
  const challengeIds = myChallenges.map((c) => c.id)
  const attempts =
    challengeIds.length > 0 && memberIds.length > 0
      ? await db
          .select({
            challengeId: ChallengeAttempt.challengeId,
            recipientUserId: ChallengeAttempt.recipientUserId,
            outcome: ChallengeAttempt.outcome,
            createdAt: ChallengeAttempt.createdAt
          })
          .from(ChallengeAttempt)
          .where(
            and(
              inArray(ChallengeAttempt.challengeId, challengeIds),
              inArray(ChallengeAttempt.recipientUserId, memberIds)
            )
          )
      : []
  const latestByUser = new Map<string, { outcome: string; at: string }>()
  const sortedAttempts = [...attempts].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  for (const a of sortedAttempts) {
    const creator = challengeCreatorById.get(a.challengeId)
    if (!creator || creator === a.recipientUserId || !memberIdSet.has(creator)) continue
    if (!latestByUser.has(a.recipientUserId)) {
      latestByUser.set(a.recipientUserId, { outcome: a.outcome, at: a.createdAt.toISOString() })
    }
  }

  const rows: TLeagueRow[] = memberIds.map((uid, idx) => {
    const m = memberById.get(uid)!
    const p = profileById.get(uid)
    const dailyPoints = dates.map((date) => {
      const g = gameByDate.get(date)
      if (!g) return 0
      const pop = scoresByGame.get(g.id) ?? []
      const mine = scoreByGameUser.get(`${g.id}:${uid}`)
      if (mine === undefined) return 0
      return percentilePoints(pop, mine)
    })
    const playedDates = dates.filter((date) => {
      const g = gameByDate.get(date)
      return g ? scoreByGameUser.has(`${g.id}:${uid}`) : false
    })
    const { total, daysPlayed } = weeklyScore(
      dates.map((date) => {
        const g = gameByDate.get(date)
        if (!g) return null
        const mine = scoreByGameUser.get(`${g.id}:${uid}`)
        if (mine === undefined) return null
        const pop = scoresByGame.get(g.id) ?? []
        return percentilePoints(pop, mine)
      })
    )
    void playedDates
    return {
      handle: p?.handle ?? `player-${idx + 1}`,
      displayName: p?.displayName ?? null,
      avatarKey: p?.avatarKey ?? 'base',
      role: m.role,
      isOwner: uid === ownerUserId,
      total,
      daysPlayed,
      todayCompleted: todaySet.has(uid),
      streak: streakById.get(uid)?.currentCount ?? 0,
      dailyPoints,
      latestRivalry: latestByUser.get(uid) ?? null
    }
  })

  rows.sort((a, b) => b.total - a.total || b.daysPlayed - a.daysPlayed || a.handle.localeCompare(b.handle))

  if (memberIdSet.has(viewerUserId)) {
    const viewerPlayed = rows.find((r) => {
      const prof = profiles.find((p) => p.userId === viewerUserId)
      return r.handle === (prof?.handle ?? '')
    })
    const hasRun = globalRuns.some((r) => r.userId === viewerUserId)
    if (viewerPlayed || hasRun) {
      await db
        .insert(XpLedger)
        .values({
          userId: viewerUserId,
          sourceKey: `league-week:${viewerUserId}:${start}`,
          amount: XP.LEAGUE_PARTICIPATION,
          reason: 'league_participation'
        })
        .onConflictDoNothing({ target: XpLedger.sourceKey })
        .catch(() => undefined)
    }
  }

  return { week: { start, end, dates }, rows }
}
