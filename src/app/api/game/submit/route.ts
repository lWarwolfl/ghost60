import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Challenge, ChallengeAttempt, DailyGame, Run, RunSession, User } from '@/drizzle/schema'
import { SubmitRequestSchema } from '@/features/game/schemas/session.schema'
import { getPlan } from '@/lib/game/entitlement'
import { getCurrentUser } from '@/lib/auth/server'
import { eventDigest } from '@/games/core/digest'
import type { GameInputEvent } from '@/games/core/game-module'
import { applyProgression, type TProgressionInput } from '@/lib/game/progression'
import { RATE_LIMITS, checkRateLimit, rateLimitedResponse } from '@/lib/game/rate-limit'
import { verifySessionToken } from '@/lib/game/token'
import { getGame } from '@/games/registry'

function isConflict(e: unknown) {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === '23505'
  )
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await checkRateLimit('submit', user.id, RATE_LIMITS.submit))) {
    return rateLimitedResponse()
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const parsed = SubmitRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  const payload = verifySessionToken(parsed.data.token)
  if (!payload || payload.userId !== user.id) {
    return NextResponse.json({ error: 'bad-token' }, { status: 401 })
  }

  return db.transaction(async (tx) => {
  await tx.select({ id: User.id }).from(User).where(eq(User.id, user.id)).for('update')
  const sessions = await tx.select().from(RunSession).where(eq(RunSession.id, payload.sessionId))
  const session = sessions[0]
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'bad-session' }, { status: 404 })
  }
  if (session.state === 'submitted') {
    const existing = await tx.select().from(Run).where(eq(Run.sessionId, session.id))
    const attempt = session.challengeId ? (await tx.select().from(ChallengeAttempt).where(and(eq(ChallengeAttempt.challengeId, session.challengeId), eq(ChallengeAttempt.recipientUserId, user.id))))[0] : null
    return NextResponse.json({ run: existing[0] ?? null, outcome: attempt?.outcome ?? null, alreadySubmitted: true })
  }
  if (session.state === 'cancelled' || session.state === 'expired' || session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'session-expired' }, { status: 410 })
  }

  if (session.challengeId) {
    const prior = await tx.select().from(ChallengeAttempt).where(and(eq(ChallengeAttempt.challengeId, session.challengeId), eq(ChallengeAttempt.recipientUserId, user.id)))
    if (prior.length) return NextResponse.json({ error: 'already-attempted' }, { status: 409 })
  }
  const games = await tx.select().from(DailyGame).where(eq(DailyGame.id, session.dailyGameId))
  const game = games[0]
  if (!game) return NextResponse.json({ error: 'no-game-today' }, { status: 409 })
  let config: unknown
  let durationMs = 60000
  try {
    const mod = getGame(game.gameId as 'pulse')
    config = mod.validateConfig(game.config)
    durationMs = mod.durationMs(config as never)
  } catch {
    return NextResponse.json({ error: 'bad-game-config' }, { status: 500 })
  }

  const events = parsed.data.events as GameInputEvent[]
  const mod = getGame(game.gameId as 'pulse')
  const result = mod.scoreRun({
    seed: game.seed,
    config: config as never,
    events,
    visibilityInterruptions: parsed.data.visibilityInterruptions
  })
  const digest = eventDigest({
    seed: game.seed,
    engineVersion: game.engineVersion,
    config,
    events
  })

  if (session.mode === 'ranked' && result.valid) {
    const dup = await tx
      .select({ id: Run.id })
      .from(Run)
      .where(
        and(
          eq(Run.userId, user.id),
          eq(Run.dailyGameId, game.id),
          eq(Run.mode, 'ranked'),
          eq(Run.valid, true)
        )
      )
    if (dup.length > 0) return NextResponse.json({ error: 'ranked-used' }, { status: 409 })
  }

  try {
    const inserted = await tx
      .insert(Run)
      .values({
        sessionId: session.id,
        userId: user.id,
        dailyGameId: game.id,
        mode: session.mode,
        rawScore: result.score,
        validatedScore: result.score,
        scoreVersion: game.engineVersion,
        eventStream: events as unknown as Record<string, unknown>,
        eventDigest: digest,
        durationMs,
        valid: result.valid,
        invalidReason: result.invalidReason ?? null,
        visibilityInterruptions: parsed.data.visibilityInterruptions
      })
      .returning()
    await tx
      .update(RunSession)
      .set({ state: 'submitted', consumedAt: session.consumedAt ?? new Date() })
      .where(eq(RunSession.id, session.id))
    const run = inserted[0]

    let outcome: string | null = null
    let attemptId: string | undefined
    let sourceScore: number | undefined
    if (session.challengeId) {
      const challenges = await tx.select().from(Challenge).where(eq(Challenge.id, session.challengeId))
      const challenge = challenges[0]
      if (challenge) {
        const sources = await tx.select().from(Run).where(eq(Run.id, challenge.sourceRunId))
        const source = sources[0]
        sourceScore = source?.validatedScore
        if (source && result.valid) {
          const delta = result.score - source.validatedScore
          outcome = delta > 0 ? 'win' : delta < 0 ? 'loss' : 'tie'
        } else {
          outcome = 'invalid'
        }
        const attempts = await tx
          .insert(ChallengeAttempt)
          .values({
            challengeId: challenge.id,
            recipientUserId: user.id,
            runId: run.id,
            outcome,
            scoreDelta: source ? result.score - source.validatedScore : 0
          })
          .onConflictDoNothing({ target: [ChallengeAttempt.challengeId, ChallengeAttempt.recipientUserId] })
          .returning()
        attemptId = attempts[0]?.id
      }
    }
    let pastSelfOutcome: string | null = null
    let pastSelfSourceScore: number | undefined
    if (session.mode === 'past_self') {
      const sourceId = (session.metadata as { sourceRunId?: string }).sourceRunId
      const source = sourceId ? (await tx.select().from(Run).where(and(eq(Run.id, sourceId), eq(Run.userId, user.id), eq(Run.dailyGameId, game.id), eq(Run.valid, true))))[0] : null
      pastSelfSourceScore = source?.validatedScore
      if (source) pastSelfOutcome = result.valid ? result.score > source.validatedScore ? 'win' : result.score < source.validatedScore ? 'loss' : 'tie' : 'invalid'
    }
    const progressionInput: TProgressionInput = {
      userId: user.id,
      run: { id: run.id, mode: run.mode, valid: run.valid, validatedScore: run.validatedScore, dailyGameId: run.dailyGameId },
      engineId: game.gameId, gameDate: game.gameDate, outcome, attemptId, sourceScore: sourceScore ?? pastSelfSourceScore, isGhostPlus: (await getPlan(user.id, tx)) === 'ghost_plus'
    }
    const applied = await applyProgression(progressionInput, tx)
    return NextResponse.json({ run, outcome, pastSelfOutcome, progression: { xpAwarded: applied.xpAwarded, unlocked: applied.unlocked, isPersonalBest: applied.isPersonalBest } })
  } catch (e) {
    if (isConflict(e)) return NextResponse.json({ error: 'ranked-used' }, { status: 409 })
    throw e
  }
  })
}
