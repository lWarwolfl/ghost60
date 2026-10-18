import { randomUUID } from 'crypto'
import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Challenge, ChallengeAttempt, DailyGame, PlayerProfile, Run, RunSession, User, type TDailyGame } from '@/drizzle/schema'
import { SessionRequestSchema } from '@/features/game/schemas/session.schema'
import { getCurrentUser } from '@/lib/auth/server'
import { getTodayDailyGame } from '@/lib/game/daily'
import { lockedResponse } from '@/lib/game/entitlement'
import { getCharges } from '@/lib/game/charges'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'
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
  if (!(await checkRateLimit('session', user.id, RATE_LIMITS.sessionCreate))) {
    return rateLimitedResponse()
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = SessionRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const { challengeId, dailyGameId: requestedDailyId, sourceRunId } = parsed.data
  let mode = parsed.data.mode


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
  } else if (mode === 'past_self') {
    const source = (await db.select().from(Run).where(and(eq(Run.id, sourceRunId as string), eq(Run.userId, user.id), eq(Run.valid, true))))[0]
    if (!source) return NextResponse.json({ error: 'source-run-unavailable' }, { status: 404 })
    game = (await db.select().from(DailyGame).where(eq(DailyGame.id, source.dailyGameId)))[0] ?? null
  } else if (mode === 'practice' && requestedDailyId) {
    game = (await db.select().from(DailyGame).where(eq(DailyGame.id, requestedDailyId)))[0] ?? null
  } else {
    game = await getTodayDailyGame()
    if (!game) return NextResponse.json({ error: 'no-game-today' }, { status: 409 })
  }

  return db.transaction(async (tx) => {
  const owners = await tx.select({ id: User.id }).from(User).where(eq(User.id, user.id)).for('update')
  if (!owners[0]) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const now = Date.now()
  const charges = await getCharges(user.id, tx, new Date(now))
  if ((mode === 'past_self' || (mode === 'practice' && requestedDailyId)) && charges.plan !== 'ghost_plus') return lockedResponse()
  if ((requestedDailyId || mode === 'past_self') && game && (game.gameDate > new Date(now).toISOString().slice(0, 10) || game.publishAt > new Date(now) || !['scheduled', 'live', 'completed'].includes(game.status))) {
    return NextResponse.json({ error: 'game-unavailable' }, { status: 410 })
  }
  if (mode === 'challenge' && challengeDailyId) {
    const daily = (await tx.select().from(DailyGame).where(eq(DailyGame.id, challengeDailyId)))[0]
    if (daily?.gameDate === new Date(now).toISOString().slice(0, 10)) {
      const rankedRuns = await tx.select({ id: Run.id }).from(Run).where(and(eq(Run.userId, user.id), eq(Run.dailyGameId, challengeDailyId), eq(Run.mode, 'ranked')))
      const rankedSessions = await tx.select().from(RunSession).where(and(eq(RunSession.userId, user.id), eq(RunSession.dailyGameId, challengeDailyId), eq(RunSession.mode, 'ranked')))
      if (rankedSessions.some((session) => session.challengeId === challengeId && !session.consumedAt && session.state === 'created' && session.expiresAt.getTime() > now) || (!rankedRuns.length && !rankedSessions.some((session) => session.consumedAt || session.state === 'submitted' || (session.state !== 'cancelled' && session.state !== 'expired' && session.expiresAt.getTime() > now)))) {
        mode = 'ranked'
        game = daily
      }
    }
  }

  if (mode === 'ranked' && game) {
    const existing = await tx
      .select({ id: Run.id })
      .from(Run)
      .where(
        and(eq(Run.userId, user.id), eq(Run.dailyGameId, game.id), eq(Run.mode, 'ranked'), eq(Run.valid, true))
      )
    if (existing.length > 0) return NextResponse.json({ error: 'ranked-used' }, { status: 409 })
  }

  const dailyGameId = mode === 'challenge' ? (challengeDailyId as string) : game?.id
  if (!dailyGameId) return NextResponse.json({ error: 'game-unavailable' }, { status: 404 })
  const targetGame =
    mode === 'challenge'
      ? ((await tx.select().from(DailyGame).where(eq(DailyGame.id, dailyGameId)))[0] ?? null)
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
  let challenge: { id: string; slug: string; handle: string; targetScore: number } | null = null
  if (challengeId) {
    const ch = (await tx.select().from(Challenge).where(eq(Challenge.id, challengeId as string)))[0]
    if (ch) {
      const src = (await tx.select().from(Run).where(eq(Run.id, ch.sourceRunId)))[0]
      const prof = (await tx.select().from(PlayerProfile).where(eq(PlayerProfile.userId, ch.creatorUserId)))[0]
      challenge = { id: ch.id, slug: ch.publicSlug, handle: prof?.handle ?? 'ghost', targetScore: src?.validatedScore ?? 0 }
    }
  }
  let pastSelf = null
  if (mode === 'past_self') {
    const source = (await tx.select().from(Run).where(and(eq(Run.id, sourceRunId as string), eq(Run.userId, user.id), eq(Run.valid, true))).orderBy(desc(Run.createdAt)))[0]
    if (!source || source.dailyGameId !== dailyGameId) return NextResponse.json({ error: 'source-run-unavailable' }, { status: 404 })
    const mod = getGame(targetGame.gameId as 'pulse')
    pastSelf = { runId: source.id, targetScore: source.validatedScore, ghost: mod.sanitizeGhost({ seed: targetGame.seed, config: config as never, events: source.eventStream as never, score: source.validatedScore }) }
  }
  const open = await tx
    .select()
    .from(RunSession)
    .where(and(eq(RunSession.userId, user.id), eq(RunSession.dailyGameId, dailyGameId), eq(RunSession.mode, mode), mode === 'challenge' ? eq(RunSession.challengeId, challengeId as string) : undefined))
  for (const s of open) {
    if (mode === 'past_self' && (s.metadata as { sourceRunId?: string }).sourceRunId !== sourceRunId) continue
    if (mode === 'ranked' && (s.consumedAt || s.state === 'submitted')) return NextResponse.json({ error: 'ranked-used' }, { status: 409 })
    if (s.consumedAt || s.state === 'submitted' || s.state === 'cancelled' || s.state === 'expired') continue
    if (s.expiresAt.getTime() > now) {
      const token = signSessionToken({
        sessionId: s.id, userId: user.id, dailyGameId, mode,
        challengeId: s.challengeId, engineVersion: targetGame.engineVersion,
        issuedAt: (s.metadata as { issuedAt?: number }).issuedAt ?? s.startedAt.getTime(), expiresAt: s.expiresAt.getTime()
      })
      return NextResponse.json({ token, sessionId: s.id, mode, expiresAt: s.expiresAt.toISOString(), resumed: true, challenge, pastSelf, game: publicGame(targetGame, config, durationMs) })
    }
    if (!s.consumedAt && !s.technicalRetryOf) {
      await tx.update(RunSession).set({ state: 'cancelled' }).where(eq(RunSession.id, s.id))
      const retryId = randomUUID()
      const retryExpiry = mode === 'ranked' ? rankedExpiry() : new Date(now + 2 * 3600000)
      const retryToken = signSessionToken({
        sessionId: retryId,
        userId: user.id,
        dailyGameId,
        mode,
        challengeId: challengeId ?? null,
        engineVersion: targetGame.engineVersion,
        issuedAt: now,
        expiresAt: retryExpiry.getTime()
      })
      await tx.insert(RunSession).values({
        id: retryId,
        userId: user.id,
        dailyGameId,
        mode,
        challengeId: challengeId ?? null,
        state: 'created',
        tokenHash: hashToken(retryToken),
        expiresAt: retryExpiry,
        technicalRetryOf: s.id,
        startedAt: s.startedAt,
        metadata: { issuedAt: now, ...(sourceRunId ? { sourceRunId } : {}) }
      })
      return NextResponse.json({
        token: retryToken,
        sessionId: retryId,
        expiresAt: retryExpiry.toISOString(),
        technicalRetry: true,
        mode,
        challenge,
        pastSelf,
        game: publicGame(targetGame, config, durationMs)
      })
    }
    await tx.update(RunSession).set({ state: 'expired' }).where(eq(RunSession.id, s.id))
  }

  if (!challengeId && charges.remaining === 0) return NextResponse.json({ error: 'charges-empty', ...charges }, { status: 403 })

  const sessionId = randomUUID()
  const expiresAt =
    mode === 'ranked' ? rankedExpiry() : mode === 'challenge' ? new Date(now + 2 * 3600000) : new Date(now + 2 * 3600000)
  const token = signSessionToken({
    sessionId,
    userId: user.id,
    dailyGameId,
    mode,
    challengeId: challengeId ?? null,
    engineVersion: targetGame.engineVersion,
    issuedAt: now,
    expiresAt: expiresAt.getTime()
  })
  await tx.insert(RunSession).values({
    id: sessionId,
    userId: user.id,
    dailyGameId,
    mode,
    challengeId: challengeId ?? null,
    state: 'created',
    tokenHash: hashToken(token),
    startedAt: new Date(now),
    expiresAt,
    metadata: sourceRunId ? { sourceRunId } : {}
  })
  return NextResponse.json({ token, sessionId, mode, expiresAt: expiresAt.toISOString(), challenge, pastSelf, game: publicGame(targetGame, config, durationMs) })
  })
}
