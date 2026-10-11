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

async function anonPage(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  const uid = ((await (await page.request.get('/api/auth/get-session')).json()).user.id) as string
  return { ctx, page, errors, uid }
}

async function rankedSessionAndToken(page: import('@playwright/test').Page, mode = 'ranked', challengeId?: string) {
  const sess = await page.request.post('/api/game/session', {
    data: challengeId ? { mode, challengeId } : { mode }
  })
  if (!sess.ok()) return null
  return (await sess.json()) as { token: string }
}

test('release: duplicate submit is idempotent, fabricated events cannot inflate', async ({ browser }) => {
  test.setTimeout(300_000)
  const sql = postgres(dbUrl(), { prepare: false })
  const { ctx, page, errors, uid } = await anonPage(browser)
  try {
    const snap = await rankedSessionAndToken(page)
    if (!snap) test.skip(true, 'no live game for ranked session')
    else {
      const payload = { token: snap.token, events: [], visibilityInterruptions: 0 }
      const first = await page.request.post('/api/game/submit', { data: payload })
      expect(first.ok()).toBeTruthy()
      const firstJson = await first.json()
      const runId = firstJson.run?.id
      expect(typeof runId).toBe('string')

      // duplicate submit with the same token: same run, no double spend
      const dup = await page.request.post('/api/game/submit', { data: payload })
      expect(dup.ok()).toBeTruthy()
      expect((await dup.json()).run?.id).toBe(runId)

      // fabricated storm: 5k taps at t=0 cannot inflate above a legit empty run
      const snap2 = await rankedSessionAndToken(page)
      if (snap2) {
        const storm = await page.request.post('/api/game/submit', {
          data: {
            token: snap2.token,
            events: Array.from({ length: 5000 }, () => ({ t: 0, type: 'tap' })),
            visibilityInterruptions: 0
          }
        })
        // ranked already used OR rejected — either way no inflated ranked score
        if (storm.ok()) {
          expect((await storm.json()).run?.validatedScore ?? 0).toBeLessThan(10_000_000)
        } else {
          expect([400, 401, 409, 410, 429]).toContain(storm.status())
        }
      }
      const runs = await sql`select count(*)::int as n from runs where user_id = ${uid} and mode = 'ranked'`
      expect(runs[0].n).toBeLessThanOrEqual(1)
    }
    expect(errors).toEqual([])
    await ctx.close()
  } finally {
    await sql`delete from challenge_attempts where recipient_user_id = ${uid}`.catch(() => undefined)
    await sql`delete from challenges where creator_user_id = ${uid}`.catch(() => undefined)
    await sql`delete from runs where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from run_sessions where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from xp_ledger where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from streaks where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from user_achievements where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from product_events where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from "session" where "userId" = ${uid}`.catch(() => undefined)
    await sql`delete from "account" where "userId" = ${uid}`.catch(() => undefined)
    await sql`delete from "user" where id = ${uid}`.catch(() => undefined)
    await sql.end()
  }
})

test('release: expired and disabled challenges stay dead', async ({ browser }) => {
  test.setTimeout(300_000)
  const sql = postgres(dbUrl(), { prepare: false })
  const { ctx, page, errors, uid } = await anonPage(browser)
  let slug = ''
  try {
    const snap = await rankedSessionAndToken(page)
    if (!snap) test.skip(true, 'no live game for ranked session')
    else {
      const sub = await page.request.post('/api/game/submit', {
        data: { token: snap.token, events: [], visibilityInterruptions: 0 }
      })
      if (!sub.ok()) test.skip(true, 'submit failed')
      else {
        const runId = (await sub.json()).run?.id as string
        const ch = await page.request.post('/api/challenges', { data: { runId } })
        expect(ch.ok()).toBeTruthy()
        const created = await ch.json()
        slug = created.slug as string
        const challengeId = created.id as string

        // expire it directly (14-day TTL cannot be waited out in QA)
        await sql`update challenges set expires_at = now() - interval '1 hour' where id = ${challengeId}`
        await page.goto(`/challenge/${slug}`)
        await page.waitForLoadState('networkidle')
        await expect(page.getByText('THIS GHOST IS GONE.')).toBeVisible()
        const sessExpired = await page.request.post('/api/game/session', {
          data: { mode: 'ranked', challengeId }
        })
        expect(sessExpired.ok()).toBeFalsy()

        // unexpire then disable via the creator route
        await sql`update challenges set expires_at = now() + interval '1 hour', disabled_at = null where id = ${challengeId}`
        const del = await page.request.delete(`/api/challenges/${challengeId}`)
        expect(del.ok()).toBeTruthy()
        await page.goto(`/challenge/${slug}`)
        await page.waitForLoadState('networkidle')
        await expect(page.getByText('THIS GHOST IS GONE.')).toBeVisible()
        const sessDisabled = await page.request.post('/api/game/session', {
          data: { mode: 'ranked', challengeId }
        })
        expect(sessDisabled.ok()).toBeFalsy()
      }
    }
    expect(errors).toEqual([])
    await ctx.close()
  } finally {
    if (slug) await sql`delete from challenges where public_slug = ${slug}`.catch(() => undefined)
    await sql`delete from challenge_attempts where recipient_user_id = ${uid}`.catch(() => undefined)
    await sql`delete from runs where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from run_sessions where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from xp_ledger where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from streaks where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from user_achievements where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from product_events where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from "session" where "userId" = ${uid}`.catch(() => undefined)
    await sql`delete from "account" where "userId" = ${uid}`.catch(() => undefined)
    await sql`delete from "user" where id = ${uid}`.catch(() => undefined)
    await sql.end()
  }
})

test('release: offline submit then reconnect retries on the same token', async ({ browser }) => {
  test.setTimeout(300_000)
  const sql = postgres(dbUrl(), { prepare: false })
  const { ctx, page, errors, uid } = await anonPage(browser)
  try {
    const snap = await rankedSessionAndToken(page)
    if (!snap) test.skip(true, 'no live game for ranked session')
    else {
      // note: page.request uses Playwright's own stack and ignores setOffline,
      // so the offline leg must go through in-page fetch.
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await ctx.setOffline(true)
      const offlineResult = await page.evaluate(async (token: string) => {
        try {
          const res = await fetch('/api/game/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, events: [], visibilityInterruptions: 0 })
          })
          return { ok: res.ok, status: res.status }
        } catch {
          return { ok: false, status: 0 }
        }
      }, snap.token)
      expect(offlineResult.ok).toBe(false)
      await ctx.setOffline(false)
      const retry = await page.request.post('/api/game/submit', {
        data: { token: snap.token, events: [], visibilityInterruptions: 0 }
      })
      expect(retry.ok()).toBeTruthy()
      expect(typeof (await retry.json()).run?.id).toBe('string')
    }
    expect(errors).toEqual([])
    await ctx.close()
  } finally {
    await sql`delete from challenge_attempts where recipient_user_id = ${uid}`.catch(() => undefined)
    await sql`delete from challenges where creator_user_id = ${uid}`.catch(() => undefined)
    await sql`delete from runs where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from run_sessions where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from xp_ledger where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from streaks where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from user_achievements where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from product_events where user_id = ${uid}`.catch(() => undefined)
    await sql`delete from "session" where "userId" = ${uid}`.catch(() => undefined)
    await sql`delete from "account" where "userId" = ${uid}`.catch(() => undefined)
    await sql`delete from "user" where id = ${uid}`.catch(() => undefined)
    await sql.end()
  }
})
