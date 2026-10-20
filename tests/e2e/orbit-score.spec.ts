import { expect, test } from '@playwright/test'

test('orbit scores when the marker is tapped', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  const anon = await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  expect(anon.ok()).toBeTruthy()
  const sess = await page.request.post('/api/game/session', {
    data: { mode: 'dev', engine: 'orbit' }
  })
  expect(sess.ok()).toBeTruthy()
  const snapshot = await sess.json()
  await page.addInitScript((snap) => {
    window.sessionStorage.setItem('ghost60:session', JSON.stringify(snap))
  }, snapshot)
  await page.goto('/play/run')
  const canvas = page.getByLabel(/Orbit field/)
  await expect(canvas).toBeVisible()
  await page.waitForTimeout(3400)
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Space')
    await page.waitForTimeout(250)
  }
  await expect(page.getByText('Run complete')).toBeVisible({ timeout: 90000 })
  const score = Number((await page.getByLabel(/^Score /).textContent()) ?? '0')
  expect(score).toBeGreaterThan(0)
  expect(errors).toEqual([])
})
