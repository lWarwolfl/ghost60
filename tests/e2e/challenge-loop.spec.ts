import { expect, test } from '@playwright/test'
import { createRng } from '@/games/core/rng'
import { getGame } from '@/games/registry'
import type { GameId } from '@/games/core/game-module'

test('challenge loop: create, race, revenge', async ({ browser }) => {
  const errors: string[] = []
  const creatorCtx = await browser.newContext()
  const creator = await creatorCtx.newPage()
  creator.on('pageerror', (e) => errors.push(`creator:${e.message}`))
  await creator.request.post('/api/auth/sign-in/anonymous', { data: {} })
  const sess = await creator.request.post('/api/game/session', { data: { mode: 'ranked' } })
  expect(sess.ok()).toBeTruthy()
  const snap = await sess.json()
  // engine-agnostic: simulate whatever today serves (spec must not assume pulse)
  const gameId = snap.game.gameId as GameId
  const mod = getGame(gameId)
  const config = mod.validateConfig(snap.game.config) as never
  const events = mod.simulate!({ seed: snap.game.seed, config, skill: 0.65, rng: createRng('loop') })
  const sub = await creator.request.post('/api/game/submit', {
    data: { token: snap.token, events, visibilityInterruptions: 0 }
  })
  expect(sub.ok()).toBeTruthy()
  const subJson = await sub.json()
  expect(subJson.run.valid).toBe(true)
  expect(subJson.run.validatedScore).toBeGreaterThan(0)
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
  await page.goto(`/challenge/${slug}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('left a ghost.')).toBeVisible({ timeout: 30000 })
  await page.getByText('RACE GHOST').click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('START RACE')).toBeVisible({ timeout: 30000 })
  await page.getByText('START RACE').click()
  const canvas = page.locator('canvas').first()
  await expect(canvas).toBeVisible({ timeout: 30000 })
  // generic playthrough: taps + keys cover every engine's input vocabulary
  const box = await canvas.boundingBox()
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' ', '1', '2']
  let finished = false
  for (let i = 0; i < 60 && !finished; i += 1) {
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.press(keys[i % keys.length])
    await page.waitForTimeout(1500)
    finished = (await page.getByText(/IT GOT AWAY|YOU CAUGHT IT|DEAD HEAT/).count()) > 0
  }
  expect(finished).toBe(true)
  await page.getByRole('button', { name: 'SHARE REVENGE', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Leave a trace.' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'COPY LINK', exact: true })).toBeVisible()
  expect(errors).toEqual([])
  await ctx.close()
  await creatorCtx.close()
})
