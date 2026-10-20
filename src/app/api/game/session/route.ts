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
import { currentSpecialGame, devGame } from '@/lib/game/studio'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'
import { hashToken, signSessionToken } from '@/lib/game/token'
import { createRng } from '@/games/core/rng'
import type { GameInputEvent, SanitizedGhost } from '@/games/core/game-module'
import { getGame } from '@/games/registry'

type TGhostView = { handle: string; targetScore: number; ghost: SanitizedGhost }

function raceGhost(game: TDailyGame, config: unknown, source?: { eventStream: unknown; validatedScore: number }): TGhostView | null {
  try {
    const mod = getGame(game.gameId as 'pulse')
    let events = source?.eventStream as GameInputEvent[] | undefined
    if (!events?.length) {
      if (typeof mod.simulate !== 'function') return null
      events = mod.simulate({ seed: game.seed, config: config as never, skill: 0.7, rng: createRng(`${game.seed}:ghost`) })
    }
    if (!events?.length) return null
    const targetScore = source?.validatedScore ?? mod.scoreRun({ seed: game.seed, config: config as never, events, visibilityInterruptions: 0 }).score
    const ghost = mod.sanitizeGhost({ seed: game.seed, config: config as never, events: events as never, score: targetScore })
    return { handle: source ? 'YOUR GHOST' : 'SPECTER', targetScore, ghost }
  } catch {
    return null
  }
}

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
  const { dailyGameId: requestedDailyId, sourceRunId, engine, challengeId } = parsed.data
  const mode = parsed.data.mode


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
  } else if (mode === 'special') {
    const special = await currentSpecialGame()
    game = special.game
    if (!special.game || (special.game.endsAt && special.game.endsAt.getTime() <= Date.now())) {
      return NextResponse.json({ error: 'special-ended' }, { status: 410 })
    }
  } else if (mode === 'dev') {
    if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'dev-disabled' }, { status: 403 })
    game = await devGame(engine ?? 'pulse')
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
  if (game?.kind === 'special' && game.endsAt && game.endsAt.getTime() <= now) {
    return NextResponse.json({ error: 'special-ended' }, { status: 410 })
  }
  if (challengeId) {
    const current = (await tx.select().from(Challenge).where(eq(Challenge.id, challengeId)))[0]
    if (!current || current.disabledAt || current.expiresAt.getTime() <= now) return NextResponse.json({ error: 'challenge-unavailable' }, { status: 410 })
    const attempted = await tx.select({ id: ChallengeAttempt.id }).from(ChallengeAttempt).where(and(eq(ChallengeAttempt.challengeId, challengeId), eq(ChallengeAttempt.recipientUserId, user.id)))
    if (attempted.length) return NextResponse.json({ error: 'already-attempted' }, { status: 409 })
  }
  if (mode === 'challenge' && challengeDailyId) {
    const daily = (await tx.select().from(DailyGame).where(eq(DailyGame.id, challengeDailyId)))[0]
    if (daily) game = daily
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
  if (targetGame.gameDate > new Date(now).toISOString().slice(0, 10) || targetGame.publishAt > new Date(now) || !['scheduled', 'live', 'completed'].includes(targetGame.status)) return NextResponse.json({ error: 'game-unavailable' }, { status: 410 })
  let challenge: { id: string; slug: string; handle: string; targetScore: number; ghost?: import('@/games/core/game-module').SanitizedGhost } | null = null
  if (challengeId) {
    const ch = (await tx.select().from(Challenge).where(eq(Challenge.id, challengeId as string)))[0]
    if (ch) {
      const src = (await tx.select().from(Run).where(eq(Run.id, ch.sourceRunId)))[0]
      const prof = (await tx.select().from(PlayerProfile).where(eq(PlayerProfile.userId, ch.creatorUserId)))[0]
      challenge = { id: ch.id, slug: ch.publicSlug, handle: prof?.handle ?? 'ghost', targetScore: src?.validatedScore ?? 0 }
      if (src?.valid && src.dailyGameId === dailyGameId) {
        const mod = getGame(targetGame.gameId as 'pulse')
        challenge.ghost = mod.sanitizeGhost({ seed: targetGame.seed, config: config as never, events: src.eventStream as never, score: src.validatedScore })
      }
    }
  }
  let pastSelf = null
  if (mode === 'past_self') {
    const source = (await tx.select().from(Run).where(and(eq(Run.id, sourceRunId as string), eq(Run.userId, user.id), eq(Run.valid, true))).orderBy(desc(Run.createdAt)))[0]
    if (!source || source.dailyGameId !== dailyGameId) return NextResponse.json({ error: 'source-run-unavailable' }, { status: 404 })
    const mod = getGame(targetGame.gameId as 'pulse')
    pastSelf = { runId: source.id, targetScore: source.validatedScore, ghost: mod.sanitizeGhost({ seed: targetGame.seed, config: config as never, events: source.eventStream as never, score: source.validatedScore }) }
  }
  let ghost: TGhostView | null = null
  if (challenge?.ghost) ghost = { handle: challenge.handle, targetScore: challenge.targetScore, ghost: challenge.ghost }
  else if (pastSelf) ghost = { handle: 'YOUR GHOST', targetScore: pastSelf.targetScore, ghost: pastSelf.ghost }
  else if (mode !== 'challenge') {
    const prior = await tx.select().from(Run).where(and(eq(Run.userId, user.id), eq(Run.dailyGameId, dailyGameId), eq(Run.valid, true)))
    const source = prior
      .filter((run) => Array.isArray(run.eventStream) && (run.eventStream as unknown[]).length > 0)
      .sort((a, b) => b.validatedScore - a.validatedScore)[0]
    ghost = raceGhost(targetGame, config, source)
  }
  if (!ghost) ghost = raceGhost(targetGame, config)
  const open = await tx
    .select()
    .from(RunSession)
    .where(and(eq(RunSession.userId, user.id), eq(RunSession.dailyGameId, dailyGameId), eq(RunSession.mode, mode), mode === 'challenge' ? eq(RunSession.challengeId, challengeId as string) : undefined))
  for (const s of open) {
    if (mode === 'past_self' && (s.metadata as { sourceRunId?: string }).sourceRunId !== sourceRunId) continue
    if (s.consumedAt || s.state === 'submitted' || s.state === 'cancelled') continue
    if (s.state !== 'expired' && s.expiresAt.getTime() > now) {
      const token = signSessionToken({
        sessionId: s.id, userId: user.id, dailyGameId, mode,
        challengeId: s.challengeId, engineVersion: targetGame.engineVersion,
        issuedAt: (s.metadata as { issuedAt?: number }).issuedAt ?? s.startedAt.getTime(), expiresAt: s.expiresAt.getTime()
      })
      return NextResponse.json({ token, sessionId: s.id, mode, expiresAt: s.expiresAt.toISOString(), resumed: true, challenge, pastSelf, ghost, game: publicGame(targetGame, config, durationMs) })
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
        ghost,
        game: publicGame(targetGame, config, durationMs)
      })
    }
    await tx.update(RunSession).set({ state: 'expired' }).where(eq(RunSession.id, s.id))
  }

  if (!challengeId && ['ranked', 'special'].includes(mode) && charges.remaining === 0) return NextResponse.json({ error: 'charges-empty', ...charges }, { status: 403 })

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
    metadata: { issuedAt: now, ...(sourceRunId ? { sourceRunId } : {}) }
  })
  return NextResponse.json({ token, sessionId, mode, expiresAt: expiresAt.toISOString(), challenge, pastSelf, ghost, game: publicGame(targetGame, config, durationMs) })
  })
}
