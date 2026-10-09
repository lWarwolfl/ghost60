import { expect, test } from '@playwright/test'

test('ghost+ locked: every paid surface denies free users server-side', async ({ browser }) => {
  const errors: string[] = []
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.request.post('/api/auth/sign-in/anonymous', { data: {} })

  const pastSelf = await page.request.post('/api/game/session', { data: { mode: 'past_self' } })
  expect(pastSelf.status()).toBe(403)
  expect((await pastSelf.json()).error).toBe('ghost-plus-locked')

  const archive = await page.request.get('/api/archive')
  expect(archive.ok()).toBeTruthy()
  const arch = await archive.json()
  expect(arch.locked).toBe(true)
  expect(arch.days.length).toBeLessThanOrEqual(7)
  expect(typeof arch.lockedOlder).toBe('number')
  const raw = JSON.stringify(arch)
  expect(raw).not.toContain('"correct"')
  expect(raw).not.toContain('"value"')
  expect(raw).not.toContain('"cells"')

  const profile = await page.request.get('/api/profile')
  expect(profile.ok()).toBeTruthy()
  const body = await profile.json()
  expect(body.history).toMatchObject({ locked: true, days: 7 })
  const premium = body.cosmetics.catalog.find((s: { entitlement: string }) => s.entitlement !== 'free')
  expect(premium).toBeTruthy()
  const free = body.cosmetics.catalog.find((s: { entitlement: string }) => s.entitlement === 'free')
  expect(free).toBeTruthy()

  const denyPremium = await page.request.patch('/api/profile/cosmetics', {
    data: { slot: 'ghost', skinId: premium.id }
  })
  expect(denyPremium.status()).toBe(403)
  expect((await denyPremium.json()).error).toBe('ghost-plus-locked')

  const allowFree = await page.request.patch('/api/profile/cosmetics', {
    data: { slot: 'ghost', skinId: free.id }
  })
  expect(allowFree.ok()).toBeTruthy()
  const after = await page.request.get('/api/profile')
  expect((await after.json()).cosmetics.equipped.ghost).toBe(free.id)

  const unknown = await page.request.patch('/api/profile/cosmetics', {
    data: { slot: 'ghost', skinId: 'nope' }
  })
  expect(unknown.status()).toBe(404)

  await page.goto('/archive')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Last 7 days')).toBeVisible()
  await page.goto('/ghost-plus')
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('Locked in this phase')).toBeVisible()

  expect(errors).toEqual([])
  await ctx.close()
})
