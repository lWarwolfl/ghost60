import { expect, test } from '@playwright/test'

test('account deletion: run, challenge, league cleaned up and session dead', async ({ browser }) => {
  const errors: string[] = []
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  const anon = await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  expect(anon.ok()).toBeTruthy()

  const league = await page.request.post('/api/leagues', { data: { name: `Delete Me ${Date.now().toString(36)}` } })
  expect(league.ok()).toBeTruthy()
  const { slug } = await league.json()

  const sess = await page.request.post('/api/game/session', { data: { mode: 'ranked' } })
  if (sess.ok()) {
    const snap = await sess.json()
    const sub = await page.request.post('/api/game/submit', {
      data: { token: snap.token, events: [], visibilityInterruptions: 0 }
    })
    if (sub.ok()) {
      const runId = (await sub.json()).run?.id
      if (runId) {
        const ch = await page.request.post('/api/challenges', { data: { runId } })
        expect(ch.ok()).toBeTruthy()
      }
    }
  }

  const profileBefore = await page.request.get('/api/profile')
  expect(profileBefore.ok()).toBeTruthy()

  const del = await page.request.delete('/api/account')
  expect(del.ok()).toBeTruthy()
  expect((await del.json()).deleted).toBe(true)

  const profileAfter = await page.request.get('/api/profile')
  expect(profileAfter.status()).toBe(401)

  const leaguesAfter = await page.request.get('/api/leagues')
  expect(leaguesAfter.status()).toBe(401)

  const leagueAfter = await page.request.get(`/api/leagues/${slug}`)
  expect(leagueAfter.status()).toBe(401)

  const second = await page.request.delete('/api/account')
  expect(second.status()).toBe(401)

  await page.goto('/settings')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Delete account')).toBeVisible()

  expect(errors).toEqual([])
  await ctx.close()
})
