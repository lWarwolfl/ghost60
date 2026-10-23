import { expect, test } from '@playwright/test'
import { createRng } from '@/games/core/rng'
import { getGame } from '@/games/registry'

const routes = [
  '/',
  '/play',
  '/profile',
  '/leagues',
  '/archive',
  '/archive/history',
  '/ghost-plus',
  '/settings',
  '/privacy',
  '/terms',
  '/dev',
]

for (const viewport of [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`all static pages and navigation at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(240000)
    await page.setViewportSize(viewport)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    expect((await page.request.post('/api/auth/sign-in/anonymous', { data: {} })).ok()).toBeTruthy()
    for (const route of routes) {
      const response = await page.goto(route)
      expect(response?.status(), route).toBe(200)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).not.toContainText(
        /Loading (?:today|profile|leagues|archive|history)/i,
        { timeout: 20000 }
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `${route} overflow`
      ).toBeLessThanOrEqual(1)
      await page.screenshot({
        path: testInfo.outputPath(`${route.replaceAll('/', '_') || 'home'}-${viewport.width}.png`),
        fullPage: true,
      })
    }
    await page.goto('/settings')
    await page.getByLabel('Motion', { exact: false }).selectOption('reduced')
    await expect(page.getByLabel('Motion', { exact: false })).toHaveValue('reduced')
    const sound = page.getByRole('switch')
    const checked = await sound.getAttribute('aria-checked')
    await sound.click()
    await expect(sound).toHaveAttribute('aria-checked', checked === 'true' ? 'false' : 'true')
    await page.reload()
    await expect(page.getByLabel('Motion', { exact: false })).toHaveValue('reduced')
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Archive', exact: true }).click()
    await expect(page).toHaveURL(/\/archive$/)
    expect(errors).toEqual([])
  })
}

test('league forms, challenge pages, past-self, replay controls and unavailable states', async ({
  page,
}, testInfo) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  await page.goto('/leagues')
  await page.getByLabel('League name', { exact: true }).fill('Night Testers')
  await page.getByRole('button', { name: 'Create league', exact: true }).click()
  await expect(page).toHaveURL(/\/leagues\/[^/]+$/)
  await expect(page.getByRole('heading', { name: 'Night Testers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Standings' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('league-detail.png'), fullPage: true })

  const session = await page.request.post('/api/game/session', {
    data: { mode: 'ranked' },
  })
  const snapshot = await session.json()
  const mod = getGame(snapshot.game.gameId)
  const config = mod.validateConfig(snapshot.game.config)
  const events = mod.simulate!({
    seed: snapshot.game.seed,
    config,
    skill: 0.9,
    rng: createRng('pages-audit'),
  })
  await page.request.post('/api/game/consume', { data: { token: snapshot.token } })
  const saved = await page.request.post('/api/game/submit', {
    data: { token: snapshot.token, events, visibilityInterruptions: 0 },
  })
  expect(saved.ok(), await saved.text()).toBeTruthy()
  const run = (await saved.json()).run
  const share = await page.request.post('/api/challenges', { data: { runId: run.id } })
  expect(share.ok(), await share.text()).toBeTruthy()
  const challenge = await share.json()
  await page.goto(`/challenge/${challenge.slug}`)
  await expect(page.getByRole('heading', { name: /left a ghost/ })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('challenge.png'), fullPage: true })
  await page.getByRole('link', { name: 'RACE GHOST', exact: true }).click()
  await expect(page.getByRole('button', { name: 'START RACE' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('challenge-preflight.png'), fullPage: true })
  await page.getByRole('button', { name: 'START RACE' }).click()
  await expect(page.getByRole('application')).toBeVisible()
  await page.goto(`/archive/replay/${run.id}`)
  await expect(page.getByLabel('Replay position')).toBeVisible()
  await page.getByRole('button', { name: 'PAUSE', exact: true }).click()
  await page.getByRole('button', { name: '4×' }).click()
  await expect(page.getByRole('button', { name: '4×' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Replay position').fill('10000')
  await page.getByRole('button', { name: 'RESTART', exact: true }).click()
  await expect(page.getByRole('button', { name: 'PAUSE', exact: true })).toBeVisible()

  const paid = await page.request.post('/api/billing/test-confirmation', {
    headers: { origin: 'http://localhost:3104' },
  })
  expect(paid.ok()).toBeTruthy()
  const past = await page.request.post('/api/game/session', {
    data: { mode: 'past_self', sourceRunId: run.id },
  })
  expect(past.ok(), await past.text()).toBeTruthy()
  expect((await past.json()).ghost.ghost.replay).toEqual(events)
  await page.goto('/archive/history')
  await expect(page.getByRole('link', { name: 'Watch ghost' }).first()).toBeVisible()
  await page.goto('/challenge/no-such-ghost')
  await expect(page.getByText(/could not be found/i)).toBeVisible()
  await page.goto('/leagues/no-such-league')
  await expect(page.getByText('League not found.')).toBeVisible()
  await page.goto('/archive/replay/00000000-0000-4000-8000-000000000000')
  await expect(page.getByText('This ghost is resting')).toBeVisible()
  expect(errors).toEqual([])
})
