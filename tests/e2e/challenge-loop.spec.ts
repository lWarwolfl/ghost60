import { expect, test } from '@playwright/test'

test('challenge loop: create, race, revenge', async ({ browser }) => {
  const errors: string[] = []
  const creatorCtx = await browser.newContext()
  const creator = await creatorCtx.newPage()
  creator.on('pageerror', (e) => errors.push(`creator:${e.message}`))
  await creator.request.post('/api/auth/sign-in/anonymous', { data: {} })
  const sess = await creator.request.post('/api/game/session', { data: { mode: 'ranked' } })
  expect(sess.ok()).toBeTruthy()
  const snap = await sess.json()
  expect(snap.game.gameId).toBe('pulse')
  const events = [4900, 11900, 19900, 27900, 35900].map((t) => ({ t, type: 'tap' }))
  const sub = await creator.request.post('/api/game/submit', {
    data: { token: snap.token, events, visibilityInterruptions: 0 }
  })
  expect(sub.ok()).toBeTruthy()
  const subJson = await sub.json()
  expect(subJson.run.validatedScore).toBe(1800)
  const runId = subJson.run.id
  const ch = await creator.request.post('/api/challenges', { data: { runId } })
  expect(ch.ok()).toBeTruthy()
  const { slug } = await ch.json()
  await creator.close()

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`recipient:${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`recipient:${m.text()}`)
  })
  page.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText))
  await page.goto(`/challenge/${slug}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('left a ghost.')).toBeVisible()
  await page.getByText('RACE GHOST').click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('START RACE')).toBeVisible()
  await page.getByText('START RACE').click()
  const canvas = page.getByLabel(/Pulse field/)
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(3600)
  const box = await canvas.boundingBox()
  for (let i = 0; i < 2; i += 1) {
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(400)
  }
  await expect(page.getByText(/IT GOT AWAY|YOU CAUGHT IT|DEAD HEAT/)).toBeVisible({ timeout: 60000 })
  await page.getByText('SEND REVENGE').click()
  await expect(page.getByText('SHARE GHOST LINK')).toBeVisible({ timeout: 15000 })
  const urlText = await page.getByText(/\/challenge\//).first().textContent()
  expect(urlText).toContain('/challenge/')
  expect(errors).toEqual([])
  await ctx.close()
  await creatorCtx.close()
})
