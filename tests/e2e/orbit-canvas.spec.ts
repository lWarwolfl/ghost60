import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'
import { createRng } from '@/games/core/rng'
import { orbitEngine } from '@/games/orbit/engine'

const GAME_DATE = '2020-02-02'

function dbUrl() {
  const raw = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
  const line = raw.split('\n').find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL missing')
  return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '')
}

test('orbit canvas: seeded challenge race plays end-to-end', async ({ browser }) => {
  const sql = postgres(dbUrl(), { prepare: false })
  const createdUserIds: string[] = []
  const errors: string[] = []
  try {
    await sql`delete from challenge_attempts where challenge_id in (select id from challenges where daily_game_id in (select id from daily_games where game_date = ${GAME_DATE}))`
    await sql`delete from challenges where daily_game_id in (select id from daily_games where game_date = ${GAME_DATE})`
    await sql`delete from runs where daily_game_id in (select id from daily_games where game_date = ${GAME_DATE})`
    await sql`delete from run_sessions where daily_game_id in (select id from daily_games where game_date = ${GAME_DATE})`
    await sql`delete from daily_games where game_date = ${GAME_DATE}`

    const config = orbitEngine.validateConfig({
      targets: [0, 1, 2, 3, 4].map((i) => ({
        angleDeg: (i * 72) % 360,
        perfectTolDeg: 5,
        goodTolDeg: 15,
        edgeTolDeg: 30,
        openMs: 3000 + i * 7000,
        closeMs: 8000 + i * 7000
      }))
    })
    const [seeded] = await sql`insert into daily_games
      (game_date, game_id, engine_version, seed, config, title, instruction, share_subtitle, difficulty, status, publish_at)
      values (${GAME_DATE}, 'orbit', 1, 'e2e-orbit', ${JSON.stringify(config)}::jsonb, 'E2E ORBIT', 'Tap when the marker enters the arc.', 'e2e', 3, 'live', now())
      returning id`
    const dailyGameId = seeded.id as string

    const events = orbitEngine.simulate!({
      seed: 'e2e-orbit',
      config,
      skill: 0.6,
      rng: createRng('e2e-orbit')
    })
    const scored = orbitEngine.scoreRun({ seed: 'e2e-orbit', config, events, visibilityInterruptions: 0 })
    expect(scored.valid).toBe(true)
    expect(scored.score).toBeGreaterThan(0)

    const ownerCtx = await browser.newContext()
    const owner = await ownerCtx.newPage()
    owner.on('pageerror', (e) => errors.push(`owner:${e.message}`))
    await owner.request.post('/api/auth/sign-in/anonymous', { data: {} })
    const sess = await owner.request.get('/api/auth/get-session')
    expect(sess.ok()).toBeTruthy()
    const creatorId = (await sess.json()).user.id as string
    createdUserIds.push(creatorId)

    const sessionId = randomUUID()
    const runId = randomUUID()
    await sql`insert into run_sessions (id, user_id, daily_game_id, mode, state, token_hash, consumed_at, expires_at, metadata)
      values (${sessionId}, ${creatorId}, ${dailyGameId}, 'ranked', 'submitted', 'e2e', now(), now() + interval '1 hour', '{}'::jsonb)`
    await sql`insert into runs (id, session_id, user_id, daily_game_id, mode, raw_score, validated_score, score_version, event_stream, event_digest, duration_ms, valid)
      values (${runId}, ${sessionId}, ${creatorId}, ${dailyGameId}, 'ranked', ${scored.score}, ${scored.score}, 1, ${JSON.stringify(events)}::jsonb, 'e2e-orbit', 45000, true)`
    const ch = await owner.request.post('/api/challenges', { data: { runId } })
    expect(ch.ok()).toBeTruthy()
    const { slug } = await ch.json()
    await owner.close()
    await ownerCtx.close()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`recipient:${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`recipient:${m.text()}`)
    })
    await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
    const rsess = await page.request.get('/api/auth/get-session')
    createdUserIds.push((await rsess.json()).user.id as string)

    await page.goto(`/challenge/${slug}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('left a ghost.')).toBeVisible()
    await page.getByText('RACE GHOST').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('START RACE')).toBeVisible()
    await page.getByText('START RACE').click()
    const canvas = page.getByLabel(/Orbit field/)
    await expect(canvas).toBeVisible()
    await page.waitForTimeout(3600)
    const box = await canvas.boundingBox()
    for (let i = 0; i < 3; i += 1) {
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await page.waitForTimeout(400)
    }
    await expect(page.getByText(/IT GOT AWAY|YOU CAUGHT IT|DEAD HEAT/)).toBeVisible({ timeout: 90000 })
    await page.getByText('SEND REVENGE').click()
    await expect(page.getByText('SHARE GHOST LINK')).toBeVisible({ timeout: 15000 })
    expect(errors).toEqual([])
    await ctx.close()
  } finally {
    for (const uid of createdUserIds) {
      await sql`delete from challenge_attempts where recipient_user_id = ${uid}`.catch(() => undefined)
      await sql`delete from xp_ledger where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from user_achievements where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from streaks where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from entitlements where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from player_profiles where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from challenges where creator_user_id = ${uid}`.catch(() => undefined)
      await sql`delete from runs where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from run_sessions where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from "user" where id = ${uid}`.catch(() => undefined)
    }
    await sql`delete from run_sessions where daily_game_id in (select id from daily_games where game_date = ${GAME_DATE})`.catch(() => undefined)
    await sql`delete from runs where daily_game_id in (select id from daily_games where game_date = ${GAME_DATE})`.catch(() => undefined)
    await sql`delete from daily_games where game_date = ${GAME_DATE}`.catch(() => undefined)
    await sql.end()
  }
})
