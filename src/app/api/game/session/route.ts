import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Challenge, ChallengeAttempt, DailyGame, PlayerProfile, Run, RunSession, type TDailyGame } from '@/drizzle/schema'
import { SessionRequestSchema } from '@/features/game/schemas/session.schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getTodayDailyGame } from '@/lib/game/daily'
import { isGhostPlus } from '@/lib/game/entitlement'
import { hashToken, signSessionToken } from '@/lib/game/token'
import { getGame } from '@/games/registry'

function rankedExpiry(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 1))
}

function publicGame(game: TDailyGame, config: unknown, durationMs: number) {
  return {
    id: game.id,
    gameDate: game.gameDate,
    gameId: game.gameId,
    engineVersion: game.engineVersion,
    seed: game.seed,
    config,
    title: game.title,
    instruction: game.instruction,
    durationMs
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = SessionRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const { mode, challengeId } = parsed.data

  if (mode === 'past_self' && !(await isGhostPlus(user.id))) {
    return NextResponse.json({ error: 'ghost-plus-locked' }, { status: 403 })
  }
  if (mode === 'practice' && !(await isGhostPlus(user.id))) {
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const used = await db
      .select({ id: Run.id })
      .from(Run)
      .where(and(eq(Run.userId, user.id), eq(Run.mode, 'practice')))
    if (used.length >= 3) return NextResponse.json({ error: 'ghost-plus-locked' }, { status: 403 })
  }

  let game: TDailyGame | null = null
  let challengeDailyId: string | null = null
  if (mode === 'challenge') {
    if (!challengeId) return NextResponse.json({ error: 'challenge-required' }, { status: 400 })
    const challenges = await db.select().from(Challenge).where(eq(Challenge.id, challengeId))
    const challenge = challenges[0]
    if (!challenge || challenge.disabledAt || challenge.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'challenge-unavailable' }, { status: 410 })
    }
    const prior = await db
      .select({ id: ChallengeAttempt.id })
      .from(ChallengeAttempt)
      .where(
        and(
          eq(ChallengeAttempt.challengeId, challenge.id),
          eq(ChallengeAttempt.recipientUserId, user.id)
        )
      )
    if (prior.length > 0) return NextResponse.json({ error: 'already-attempted' }, { status: 409 })
    challengeDailyId = challenge.dailyGameId
  } else {
    game = await getTodayDailyGame()
    if (!game) return NextResponse.json({ error: 'no-game-today' }, { status: 409 })
  }

  if (mode === 'ranked' && game) {
    const existing = await db
      .select({ id: Run.id })
      .from(Run)
      .where(
        and(eq(Run.userId, user.id), eq(Run.dailyGameId, game.id), eq(Run.mode, 'ranked'), eq(Run.valid, true))
      )
    if (existing.length > 0) return NextResponse.json({ error: 'ranked-used' }, { status: 409 })
  }

  const dailyGameId = mode === 'challenge' ? (challengeDailyId as string) : (game as TDailyGame).id
  const targetGame =
    mode === 'challenge'
      ? ((await db.select().from(DailyGame).where(eq(DailyGame.id, dailyGameId)))[0] ?? null)
      : game
  if (!targetGame) return NextResponse.json({ error: 'no-game-today' }, { status: 409 })
  let config: unknown
  let durationMs = 60000
  try {
    const mod = getGame(targetGame.gameId as 'pulse')
    config = mod.validateConfig(targetGame.config)
    durationMs = mod.durationMs(config as never)
  } catch {
    return NextResponse.json({ error: 'bad-game-config' }, { status: 500 })
  }
  const now = Date.now()
  const open = await db
    .select()
    .from(RunSession)
    .where(and(eq(RunSession.userId, user.id), eq(RunSession.dailyGameId, dailyGameId), eq(RunSession.mode, mode)))
  for (const s of open) {
    if (s.state === 'submitted' || s.state === 'cancelled' || s.state === 'expired') continue
    if (s.expiresAt.getTime() > now) {
      if (s.consumedAt) return NextResponse.json({ error: 'attempt-spent' }, { status: 409 })
      return NextResponse.json({ error: 'session-active' }, { status: 409 })
    }
    if (!s.consumedAt && !s.technicalRetryOf) {
      await db.update(RunSession).set({ state: 'cancelled' }).where(eq(RunSession.id, s.id))
      const retryId = randomUUID()
      const retryExpiry = mode === 'ranked' ? rankedExpiry() : new Date(now + 2 * 3600000)
      const retryToken = signSessionToken({
        sessionId: retryId,
        userId: user.id,
        dailyGameId,
        mode,
        challengeId: mode === 'challenge' ? (challengeId as string) : null,
        engineVersion: targetGame.engineVersion,
        issuedAt: now,
        expiresAt: retryExpiry.getTime()
      })
      await db.insert(RunSession).values({
        id: retryId,
        userId: user.id,
        dailyGameId,
        mode,
        challengeId: mode === 'challenge' ? (challengeId as string) : null,
        state: 'created',
        tokenHash: hashToken(retryToken),
        expiresAt: retryExpiry,
        technicalRetryOf: s.id,
        metadata: {}
      })
      return NextResponse.json({
        token: retryToken,
        sessionId: retryId,
        expiresAt: retryExpiry.toISOString(),
        technicalRetry: true,
        challenge: null,
        game: publicGame(targetGame, config, durationMs)
      })
    }
    await db.update(RunSession).set({ state: 'expired' }).where(eq(RunSession.id, s.id))
  }

  const sessionId = randomUUID()
  const expiresAt =
    mode === 'ranked' ? rankedExpiry() : mode === 'challenge' ? new Date(now + 2 * 3600000) : new Date(now + 2 * 3600000)
  const token = signSessionToken({
    sessionId,
    userId: user.id,
    dailyGameId,
    mode,
    challengeId: mode === 'challenge' ? (challengeId as string) : null,
    engineVersion: targetGame.engineVersion,
    issuedAt: now,
    expiresAt: expiresAt.getTime()
  })
  await db.insert(RunSession).values({
    id: sessionId,
    userId: user.id,
    dailyGameId,
    mode,
    challengeId: mode === 'challenge' ? (challengeId as string) : null,
    state: 'created',
    tokenHash: hashToken(token),
    expiresAt,
    metadata: {}
  })
  let challenge: { id: string; slug: string; handle: string; targetScore: number } | null = null
  if (mode === 'challenge') {
    const ch = (await db.select().from(Challenge).where(eq(Challenge.id, challengeId as string)))[0]
    if (ch) {
      const src = (await db.select().from(Run).where(eq(Run.id, ch.sourceRunId)))[0]
      const prof = (await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, ch.creatorUserId)))[0]
      challenge = {
        id: ch.id,
        slug: ch.publicSlug,
        handle: prof?.handle ?? 'ghost',
        targetScore: src?.validatedScore ?? 0
      }
    }
  }
  return NextResponse.json({ token, sessionId, expiresAt: expiresAt.toISOString(), challenge, game: publicGame(targetGame, config, durationMs) })
}
