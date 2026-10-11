// One-shot ops script (also used in Phase 14 QA): index inventory + EXPLAIN on
// the hot paths + table sizes. Run with `npx tsx scripts/qa-db-inspect.ts`.
import './env'
import { sql } from 'drizzle-orm'
import { db, dbClient } from '@/drizzle'

const TABLES = [
  'runs',
  'run_sessions',
  'challenges',
  'challenge_attempts',
  'leagues',
  'league_members',
  'product_events',
  'rate_limits',
  'xp_ledger',
  'streaks'
]

type TRow = Record<string, string>

async function main() {
  console.log('--- indexes on hot tables ---')
  const names = TABLES.map((t) => `'${t}'`).join(',')
  const idx = (await db.execute(sql.raw(`
    select tablename, indexname, indexdef from pg_indexes
    where schemaname = 'public' and tablename in (${names})
    order by tablename, indexname`))) as unknown as TRow[]
  for (const row of idx) {
    console.log(`${row.tablename}.${row.indexname}: ${row.indexdef}`)
  }
  console.log('--- explain: ranked-uniqueness lookup ---')
  const q1 = (await db.execute(sql`
    explain select id from runs where user_id = '00000000-0000-0000-0000-000000000000'
    and daily_game_id = '00000000-0000-0000-0000-000000000000' and mode = 'ranked' and valid = true limit 1`)) as unknown as TRow[]
  for (const row of q1) console.log(' ', Object.values(row)[0])
  console.log('--- explain: product_events funnel scan ---')
  const q2 = (await db.execute(sql`
    explain select count(*) from product_events
    where event_name = 'ranked_run_finished' and created_at > now() - interval '7 days'`)) as unknown as TRow[]
  for (const row of q2) console.log(' ', Object.values(row)[0])
  console.log('--- explain: league standings member scan ---')
  const q3 = (await db.execute(sql`
    explain select user_id from league_members where league_id = '00000000-0000-0000-0000-000000000000'`)) as unknown as TRow[]
  for (const row of q3) console.log(' ', Object.values(row)[0])
  console.log('--- table sizes ---')
  const sizes = (await db.execute(sql.raw(`
    select relname as "table", pg_size_pretty(pg_total_relation_size(oid)) as size
    from pg_class where relname in (${names}) order by pg_total_relation_size(oid) desc`))) as unknown as TRow[]
  for (const row of sizes) console.log(' ', JSON.stringify(row))
  await dbClient.end()
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error('ERR', e)
    process.exit(1)
  }
)
