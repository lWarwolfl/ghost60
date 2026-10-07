import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/drizzle'
import { Challenge, ChallengeAttempt, DailyGame, Run, RunSession } from '@/drizzle/schema'
import { SubmitRequestSchema } from '@/features/game/schemas/session.schema'
import { getCurrentUser } from '@/lib/auth/server'
import { eventDigest } from '@/games/core/digest'
import type { GameInputEvent } from '@/games/core/game-module'
import { applyProgression } from '@/lib/game/progression'
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

  const sessions = await db.select().from(RunSession).where(eq(RunSession.id, payload.sessionId))
  const session = sessions[0]
  if (!session || session.userId !== user.id) {
    return NextResponse.json({ error: 'bad-session' }, { status: 404 })
  }
  if (session.state === 'submitted') {
    const existing = await db.select().from(Run).where(eq(Run.sessionId, session.id))
    return NextResponse.json({ run: existing[0] ?? null, alreadySubmitted: true })
  }
  if (session.state === 'cancelled' || session.state === 'expired' || session.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'session-expired' }, { status: 410 })
  }

  const games = await db.select().from(DailyGame).where(eq(DailyGame.id, session.dailyGameId))
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
    const dup = await db
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
    const inserted = await db
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
    await db
      .update(RunSession)
      .set({ state: 'submitted', consumedAt: session.consumedAt ?? new Date() })
      .where(eq(RunSession.id, session.id))
    const run = inserted[0]

    let outcome: string | null = null
    let attemptId: string | undefined
    let sourceScore: number | undefined
    if (session.mode === 'challenge' && session.challengeId) {
      const challenges = await db.select().from(Challenge).where(eq(Challenge.id, session.challengeId))
      const challenge = challenges[0]
      if (challenge) {
        const sources = await db.select().from(Run).where(eq(Run.id, challenge.sourceRunId))
        const source = sources[0]
        sourceScore = source?.validatedScore
        if (source && result.valid) {
          const delta = result.score - source.validatedScore
          outcome = delta > 0 ? 'win' : delta < 0 ? 'loss' : 'tie'
        } else {
          outcome = 'invalid'
        }
        const attempts = await db
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
    let progression = { xpAwarded: 0, unlocked: [] as string[], isPersonalBest: false }
    try {
      const applied = await applyProgression({
        userId: user.id,
        run: { id: run.id, mode: run.mode, valid: run.valid, validatedScore: run.validatedScore, dailyGameId: run.dailyGameId },
        engineId: game.gameId,
        gameDate: game.gameDate,
        outcome,
        attemptId,
        sourceScore,
        isGhostPlus: false
      })
      progression = { xpAwarded: applied.xpAwarded, unlocked: applied.unlocked, isPersonalBest: applied.isPersonalBest }
    } catch {
      progression = { xpAwarded: 0, unlocked: [], isPersonalBest: false }
    }
    return NextResponse.json({ run, outcome, progression })
  } catch (e) {
    if (isConflict(e)) return NextResponse.json({ error: 'ranked-used' }, { status: 409 })
    throw e
  }
}
