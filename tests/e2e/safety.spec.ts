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

test('safety: report accepts, block/unblock by handle works', async ({ browser }) => {
  const errors: string[] = []
  const sql = postgres(dbUrl(), { prepare: false })
  const createdUserIds: string[] = []
  try {
    const ctxA = await browser.newContext()
    const a = await ctxA.newPage()
    a.on('pageerror', (e) => errors.push(`a:${e.message}`))
    await a.request.post('/api/auth/sign-in/anonymous', { data: {} })
    const aId = ((await (await a.request.get('/api/auth/get-session')).json()).user.id) as string
    createdUserIds.push(aId)

    const ctxB = await browser.newContext()
    const b = await ctxB.newPage()
    b.on('pageerror', (e) => errors.push(`b:${e.message}`))
    await b.request.post('/api/auth/sign-in/anonymous', { data: {} })
    const bId = ((await (await b.request.get('/api/auth/get-session')).json()).user.id as string)
    createdUserIds.push(bId)
    const bHandle = `blockee-${Date.now().toString(36)}`
    await sql`insert into player_profiles (user_id, handle) values (${bId}, ${bHandle})
      on conflict (user_id) do update set handle = ${bHandle}`

    const report = await a.request.post('/api/reports', {
      data: { subjectType: 'handle', subjectKey: bHandle, reason: 'spam' }
    })
    expect(report.ok()).toBeTruthy()

    const badReport = await a.request.post('/api/reports', {
      data: { subjectType: 'handle', subjectKey: bHandle, reason: 'nonsense' }
    })
    expect(badReport.status()).toBe(400)

    const blocked = await a.request.post('/api/blocks', { data: { handle: bHandle } })
    expect(blocked.ok()).toBeTruthy()
    const again = await a.request.post('/api/blocks', { data: { handle: bHandle } })
    expect(again.ok()).toBeTruthy()

    const unknown = await a.request.post('/api/blocks', { data: { handle: 'ghost-nobody-here' } })
    expect(unknown.status()).toBe(404)

    const unblocked = await a.request.delete('/api/blocks', { data: { handle: bHandle } })
    expect(unblocked.ok()).toBeTruthy()

    expect(errors).toEqual([])
    await ctxA.close()
    await ctxB.close()
  } finally {
    for (const uid of createdUserIds) {
      await sql`delete from challenge_attempts where recipient_user_id = ${uid}`.catch(() => undefined)
      await sql`delete from xp_ledger where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from user_achievements where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from streaks where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from entitlements where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from player_profiles where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from blocks where blocker_user_id = ${uid} or blocked_user_id = ${uid}`.catch(() => undefined)
      await sql`delete from reports where reporter_user_id = ${uid}`.catch(() => undefined)
      await sql`delete from challenges where creator_user_id = ${uid}`.catch(() => undefined)
      await sql`delete from runs where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from run_sessions where user_id = ${uid}`.catch(() => undefined)
      await sql`delete from "session" where "userId" = ${uid}`.catch(() => undefined)
      await sql`delete from "account" where "userId" = ${uid}`.catch(() => undefined)
      await sql`delete from "user" where id = ${uid}`.catch(() => undefined)
    }
    await sql.end()
  }
})
