import { expect, test } from '@playwright/test'

test('pulse practice run submits from canvas taps', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText))
  const anon = await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  expect(anon.ok()).toBeTruthy()
  const sess = await page.request.post('/api/game/session', { data: { mode: 'practice' } })
  expect(sess.ok()).toBeTruthy()
  const snapshot = await sess.json()
  await page.addInitScript((snap) => {
    window.sessionStorage.setItem('ghost60:session', JSON.stringify(snap))
  }, snapshot)
  await page.goto('/play/run')
  if (snapshot.game.gameId !== 'pulse' && snapshot.game.gameId !== 'snap') {
    await expect(page.getByText('Engine UI lands in Phase 8')).toBeVisible()
    expect(errors).toEqual([])
    return
  }
  const canvas = page.getByLabel(/Pulse field|Snap field/)
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(3600)
  const box = await canvas.boundingBox()
  expect(box).not.toBeNull()
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.waitForTimeout(400)
  }
  await expect(page.getByText('Server validated')).toBeVisible({ timeout: 60000 })
  expect(errors).toEqual([])
})
