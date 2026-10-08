import './env'
import { and, eq, gte, lte } from 'drizzle-orm'
import { db, dbClient } from '@/drizzle'
import { DailyGame, GameDefinition, Season } from '@/drizzle/schema'
import { buildDayConfig } from '@/games/content/builder'
import { loadCatalog, loadSchedule, validateScheduleRules } from '@/games/content/schedule'
import { simulateDay } from '@/games/content/simulate'
import { getGame } from '@/games/registry'

const SKILLS = [0.25, 0.55, 0.9]
const SEEDS = 6

function arg(name: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

function shiftDay(dateStr: string, delta: number) {
  return new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + delta * 86400000).toISOString().slice(0, 10)
}

async function main() {
  const checkOnly = process.argv.includes('--check')
  const schedule = loadSchedule()
  const catalog = loadCatalog()
  const ruleErrors = validateScheduleRules(schedule, catalog)
  if (ruleErrors.length > 0) {
    for (const e of ruleErrors) console.error(`RULE ${e}`)
    process.exit(1)
  }

  let blocked = false
  const rows: Array<{
    date: string
    engine: string
    title: string
    means: string
    invalid: number
    flags: string
  }> = []
  for (const day of schedule.days) {
    const built = buildDayConfig(day)
    const report = simulateDay(day, built.config, SKILLS, SEEDS)
    if (report.flags.includes('impossible') || report.invalidRuns > 0) blocked = true
    rows.push({
      date: day.seedKey,
      engine: day.engine,
      title: day.title,
      means: report.means.map((m) => Math.round(m).toString()).join('/'),
      invalid: report.invalidRuns,
      flags: report.flags.length > 0 ? report.flags.join('+') : 'ok'
    })
  }
  console.log('day | engine | means(low/med/high) | invalid | flags')
  for (const r of rows) console.log(`${r.date} | ${r.engine} | ${r.means} | ${r.invalid} | ${r.flags} | ${r.title}`)

  if (blocked) {
    console.error('BLOCKED: impossible days or invalid sim runs — fix content before import.')
    process.exit(1)
  }
  if (checkOnly) {
    console.log('CHECK passed: 30 deterministic days, all sims valid, none impossible.')
    return
  }

  const start = arg('start')
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    console.error('Usage: import-schedule --start=YYYY-MM-DD [--check] (day 1 maps to --start)')
    process.exit(1)
  }

  const seasonRows = await db.select().from(Season).where(eq(Season.slug, schedule.season.slug))
  let seasonId = seasonRows[0]?.id
  if (!seasonId) {
    const inserted = await db
      .insert(Season)
      .values({
        slug: schedule.season.slug,
        name: schedule.season.name,
        startsAt: new Date(`${start}T00:00:00Z`),
        endsAt: new Date(`${shiftDay(start, 30)}T00:00:00Z`),
        config: {}
      })
      .returning()
    seasonId = inserted[0].id
  }

  for (const gameId of ['pulse', 'snap', 'orbit', 'recall', 'shift', 'trace'] as const) {
    const mod = getGame(gameId)
    const existing = await db.select().from(GameDefinition).where(eq(GameDefinition.id, gameId))
    if (existing.length === 0) {
      await db.insert(GameDefinition).values({
        id: gameId,
        engineVersion: mod.engineVersion,
        name: gameId.toUpperCase(),
        skillCategory: gameId,
        durationMs: mod.durationMs(undefined as never),
        configSchemaVersion: 1,
        active: true
      })
    }
  }

  let inserted = 0
  let skipped = 0
  for (const day of schedule.days) {
    const built = buildDayConfig(day)
    const gameDate = shiftDay(start, day.day - 1)
    const mod = getGame(day.engine as 'pulse')
    try {
      await db.insert(DailyGame).values({
        gameDate,
        gameId: day.engine,
        engineVersion: mod.engineVersion,
        seed: built.seed,
        config: built.config as Record<string, unknown>,
        title: day.title,
        instruction: day.instruction,
        shareSubtitle: day.shareSubtitle,
        difficulty: day.difficulty,
        seasonId,
        status: 'scheduled',
        publishAt: new Date(`${gameDate}T00:00:00Z`)
      })
      inserted += 1
    } catch {
      skipped += 1
    }
  }
  const first = shiftDay(start, 0)
  const last = shiftDay(start, 29)
  const present = await db
    .select({ gameDate: DailyGame.gameDate })
    .from(DailyGame)
    .where(and(gte(DailyGame.gameDate, first), lte(DailyGame.gameDate, last)))
  console.log(`IMPORT done: inserted=${inserted} skipped-existing=${skipped} window=${first}..${last} present=${present.length}`)
  await dbClient.end()
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }
)
