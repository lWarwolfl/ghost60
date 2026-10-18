import './env'
import { and, count, eq, gte, isNull, lt, lte } from 'drizzle-orm'
import { db, dbClient } from '@/drizzle'
import {
  DailyGame,
  GameDefinition,
  League,
  LeagueMember,
  ProductEvent,
  Run,
  RunSession,
} from '@/drizzle/schema'
import type { GameId } from '@/games/core/game-module'
import { getGame } from '@/games/registry'
import { summarizeLaunchStatus } from '@/lib/game/launch-status'

async function main() {
  try {
    if (process.argv.slice(2).some((arg) => arg !== '--check'))
      throw new Error('Usage: launch-status [--check]')
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const start = new Date(`${today}T00:00:00Z`)
    const through = new Date(start.getTime() + 29 * 86_400_000).toISOString().slice(0, 10)
    const [days, definitions, runs, sessions, events, leagues] = await Promise.all([
      db
        .select()
        .from(DailyGame)
        .where(and(gte(DailyGame.gameDate, today), lte(DailyGame.gameDate, through))),
      db.select().from(GameDefinition),
      db
        .select({ valid: Run.valid, invalidReason: Run.invalidReason, count: count() })
        .from(Run)
        .where(and(gte(Run.createdAt, start), lt(Run.createdAt, now)))
        .groupBy(Run.valid, Run.invalidReason),
      db
        .select({ total: count(), completed: count(Run.id) })
        .from(RunSession)
        .leftJoin(Run, eq(Run.sessionId, RunSession.id))
        .where(and(gte(RunSession.startedAt, start), lt(RunSession.startedAt, now))),
      db
        .select({ eventName: ProductEvent.eventName, count: count() })
        .from(ProductEvent)
        .where(and(gte(ProductEvent.createdAt, start), lt(ProductEvent.createdAt, now)))
        .groupBy(ProductEvent.eventName),
      db
        .select({
          id: League.id,
          publicSlug: League.publicSlug,
          name: League.name,
          members: count(LeagueMember.userId),
        })
        .from(League)
        .leftJoin(LeagueMember, eq(LeagueMember.leagueId, League.id))
        .where(isNull(League.archivedAt))
        .groupBy(League.id),
    ])
    const summary = summarizeLaunchStatus({
      now,
      errorTelemetryEnabled: process.env.ERROR_TELEMETRY_ENABLED === 'true',
      scheduledDates: days.map((day) => day.gameDate),
      runs,
      sessions: sessions[0],
      events,
    })
    const day = days.find((row) => row.gameDate === today)
    let configError: string | null = null
    try {
      if (!day) throw new Error('missing-today')
      const engine = getGame(day.gameId as GameId)
      if (!engine || engine.engineVersion !== day.engineVersion)
        throw new Error('unsupported-engine-version')
      if (
        !definitions.some(
          (definition) =>
            definition.id === day.gameId &&
            definition.engineVersion === day.engineVersion &&
            definition.active
        )
      ) {
        throw new Error('missing-active-game-definition')
      }
      const config = engine.validateConfig(day.config)
      const durationMs = engine.durationMs(config)
      if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('invalid-duration')
      if (!day.seed.trim()) throw new Error('missing-seed')
      if (!['scheduled', 'live'].includes(day.status) || day.publishAt > now)
        throw new Error('today-not-published')
    } catch (error) {
      configError = error instanceof Error ? error.message : String(error)
    }
    const ready = summary.coverage.ready && configError === null
    console.log(
      JSON.stringify(
        {
          checkedAt: now.toISOString(),
          readOnly: true,
          ready,
          readinessChecks: [
            '30-day persisted schedule coverage including today',
            'published and valid present-day engine/config',
          ],
          metricsWindow: {
            from: start.toISOString(),
            toExclusive: now.toISOString(),
            sessionCompletion: 'sessions started in window with a persisted run, valid or invalid',
          },
          ...summary,
          todayConfig: {
            valid: configError === null,
            error: configError,
            gameId: day?.gameId ?? null,
            engineVersion: day?.engineVersion ?? null,
          },
          leagues: {
            launchStatus: 'unverified-no-designated-launch-league',
            active: leagues.length,
            existing: leagues,
          },
          limitations: [
            'Read-only: does not seed dates, create leagues, or exercise the live UTC rollover.',
            'Zero traffic is not a readiness failure; null ratios mean no samples.',
            'Challenge opens are client analytics, not unique visitors.',
            'Error telemetry is opt-in (ERROR_TELEMETRY_ENABLED=true); null errorEvents means disabled, not zero errors. Error database failures fall back to server logs.',
            'League launch status reports existing non-archived leagues; no designated launch league is configured.',
          ],
        },
        null,
        2
      )
    )
    if (!ready) process.exitCode = 1
  } finally {
    await dbClient.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error('launch-status failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
