import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

function dbUrl() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
  const line = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL missing')
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
}

test('analytics: batched ingest accepts, rejects, hashes anon id', async ({ browser }) => {
  const errors: string[] = []
  const sql = postgres(dbUrl(), { prepare: false })
  let uid = ''
  try {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
    uid = ((await (await page.request.get('/api/auth/get-session')).json()).user.id) as string

    const before = await sql`select count(*)::int as n from product_events where user_id = ${uid}`

    const ok = await page.request.post('/api/events', {
      data: {
        events: [
          { name: 'daily_game_viewed', properties: { game: 'pulse' }, anonId: 'anon-123', sessionKey: 'sess-1' },
          { name: 'play_cta_clicked', properties: { game: 'pulse' } }
        ]
      }
    })
    expect(ok.ok()).toBeTruthy()
    expect((await ok.json()).accepted).toBe(2)

    const rows = await sql`select event_name, anon_id_hash, session_key, properties
      from product_events where user_id = ${uid} order by id desc limit 2`
    expect(rows).toHaveLength(2)
    const viewed = rows.find((r) => r.event_name === 'daily_game_viewed')
    expect(viewed?.session_key).toBe('sess-1')
    expect(viewed?.anon_id_hash).not.toBe('anon-123')
    expect(viewed?.anon_id_hash).toHaveLength(64)
    expect(viewed?.properties).toEqual({ game: 'pulse' })

    const badName = await page.request.post('/api/events', { data: { events: [{ name: 'checkout_started' }] } })
    expect(badName.status()).toBe(400)

    const badProps = await page.request.post('/api/events', {
      data: { events: [{ name: 'result_viewed', properties: { nested: { a: 1 } } }] }
    })
    expect(badProps.status()).toBe(400)

    const tooMany = await page.request.post('/api/events', {
      data: { events: Array.from({ length: 26 }, () => ({ name: 'result_viewed' })) }
    })
    expect(tooMany.status()).toBe(400)

    const after = await sql`select count(*)::int as n from product_events where user_id = ${uid}`
    expect(after[0].n).toBe(before[0].n + 2)

    // funnel wiring: session create emits ranked_session_started server-side? no —
    // client-side. Verify the emit path exists by posting what the client sends.
    const sess = await page.request.post('/api/events', {
      data: { events: [{ name: 'ranked_session_started', properties: { challenge: false } }] }
    })
    expect(sess.ok()).toBeTruthy()

    expect(errors).toEqual([])
    await ctx.close()
  } finally {
    if (uid) await sql`delete from product_events where user_id = ${uid}`.catch(() => undefined)
    await sql.end()
  }
})
