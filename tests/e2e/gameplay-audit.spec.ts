import { expect, test, type Page } from '@playwright/test'
import { markerCrossingAt } from '@/games/orbit/table'
import { traceView, toScreen } from '@/games/trace/table'
import type { TGameSnapshot } from '@/features/game/store/game-store'
import type { TPulseConfig } from '@/games/pulse/engine'
import type { TSnapConfig } from '@/games/snap/engine'
import type { TOrbitConfig } from '@/games/orbit/engine'
import type { TRecallConfig } from '@/games/recall/engine'
import type { TShiftConfig } from '@/games/shift/engine'
import type { TTraceConfig } from '@/games/trace/engine'

async function advanceTo(page: Page, game: TGameSnapshot['game'], target: number) {
  const remaining = Number.parseFloat(await page.locator('.game-timer').innerText()) * 1000
  await page.clock.fastForward(Math.max(1, target - (game.durationMs - remaining)))
}

for (const engine of ['pulse', 'snap', 'orbit', 'recall', 'shift', 'trace'] as const) {
  test(`${engine}: play, visible action points, saved replay, and independent past ghost`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180000)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    expect((await page.request.post('/api/auth/sign-in/anonymous', { data: {} })).ok()).toBeTruthy()
    const response = await page.request.post('/api/game/session', { data: { mode: 'dev', engine } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const snapshot: TGameSnapshot = await response.json()
    await page.goto('/dev')
    await page.evaluate(
      (snapshot) => sessionStorage.setItem('ghost60:session', JSON.stringify(snapshot)),
      snapshot
    )
    await page.clock.install()
    await page.goto('/play/run')
    await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'countdown')
    await page.clock.fastForward(3300)
    await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'running')
    const canvas = page.getByRole('application')
    const submit = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/game/submit') && response.request().method() === 'POST'
    )
    if (engine === 'pulse') {
      const bandSizes: number[] = []
      for (const pulse of (snapshot.game.config as TPulseConfig).pulses) {
        await advanceTo(page, snapshot.game, pulse.targetMs - 300)
        if (bandSizes.length < 2) {
          bandSizes.push(
            await canvas.evaluate((node) => {
              const canvas = node as HTMLCanvasElement
              const data = canvas
                .getContext('2d')!
                .getImageData(
                  Math.floor(canvas.width / 2),
                  0,
                  1,
                  Math.floor(canvas.height / 2)
                ).data
              for (let y = 0; y < data.length / 4; y++) {
                if (data[y * 4] < 140 && data[y * 4 + 1] > 200 && data[y * 4 + 2] > 170)
                  return canvas.height / 2 - y
              }
              return 0
            })
          )
        }
        await advanceTo(page, snapshot.game, pulse.targetMs)
        await page.keyboard.press('Space')
      }
      expect(Math.min(...bandSizes)).toBeGreaterThan(0)
      expect(Math.abs(bandSizes[0] - bandSizes[1])).toBeGreaterThan(3)
    } else if (engine === 'snap') {
      for (const round of (snapshot.game.config as TSnapConfig).rounds) {
        await advanceTo(page, snapshot.game, round.presentedMs + 150)
        await page.keyboard.press(String(round.correct + 1))
      }
    } else if (engine === 'orbit') {
      const config = snapshot.game.config as TOrbitConfig
      for (const target of config.targets) {
        const at = markerCrossingAt(
          target.angleDeg,
          (target.openMs + target.closeMs) / 2,
          config.markerPeriodMs,
          config.markerRamp,
          snapshot.game.durationMs
        )
        await advanceTo(page, snapshot.game, at)
        // Pointer taps must use the moving marker, even when tapping the middle of the field.
        await canvas.click({ position: { x: 20, y: 20 } })
      }
    } else if (engine === 'recall') {
      const config = snapshot.game.config as TRecallConfig
      for (const sequence of config.sequences) {
        await page.clock.fastForward(800 + sequence.cells.length * 800)
        await expect(page.locator('.game-chip')).toContainText('YOUR TURN')
        for (const cell of sequence.cells) {
          // All grids support arrow navigation, including cells beyond digits 1–9.
          await page.keyboard.press('Home')
          if (cell < 9) await page.keyboard.press(String(cell + 1))
          else {
            // Pointer input for the lower cells of a 4×4 grid.
            const box = (await canvas.boundingBox())!
            const board = Math.min(box.width - 32, box.height - 32)
            const pitch = board / config.grid
            await canvas.click({
              position: {
                x: (box.width - board) / 2 + ((cell % config.grid) + 0.5) * pitch,
                y: (box.height - board) / 2 + (Math.floor(cell / config.grid) + 0.5) * pitch,
              },
            })
          }
          await page.clock.fastForward(100)
        }
      }
    } else if (engine === 'shift') {
      for (const card of (snapshot.game.config as TShiftConfig).cards) {
        await advanceTo(page, snapshot.game, card.presentedMs + 150)
        await page
          .getByLabel(card.correct === 0 ? 'Tap left' : 'Tap right', { exact: true })
          .click()
      }
    } else {
      const config = snapshot.game.config as TTraceConfig
      const box = (await canvas.boundingBox())!
      const view = traceView(box.width, box.height)
      const first = toScreen(config.gates[0], view)
      await page.mouse.move(box.x + first.x, box.y + first.y)
      await page.mouse.down()
      for (let i = 1; i < config.gates.length; i++) {
        const a = config.gates[i - 1],
          b = config.gates[i]
        for (let step = 1; step <= 6; step++) {
          const p = toScreen(
            { x: a.x + ((b.x - a.x) * step) / 6, y: a.y + ((b.y - a.y) * step) / 6 },
            view
          )
          await page.mouse.move(box.x + p.x, box.y + p.y)
          await page.clock.fastForward(60)
        }
      }
      await page.mouse.up()
    }
    const points = page.getByTestId('action-feedback').last()
    await expect(points).toBeVisible()
    const fontSize = await points.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).fontSize)
    )
    expect(fontSize).toBeGreaterThanOrEqual(26)
    await page.clock.fastForward(900)
    await expect(points).toBeVisible()
    const pointPosition = await points.evaluate((node) => ({
      x: parseFloat((node as HTMLElement).style.left) / 100,
      y: parseFloat((node as HTMLElement).style.top) / 100,
    }))
    const arena = engine === 'orbit' ? await canvas.boundingBox() : null
    await page.screenshot({ path: testInfo.outputPath(`${engine}-points.png`), fullPage: true })
    await page.clock.fastForward(snapshot.game.durationMs + 4000)
    const submitted = await (await submit).json()
    expect(submitted.run.valid).toBe(true)
    expect(submitted.run.validatedScore).toBeGreaterThan(0)
    await expect(page.getByText('Run complete', { exact: true })).toBeVisible()
    const replay = await page.request.get(`/api/archive/replay?runId=${submitted.run.id}`)
    expect(replay.ok()).toBeTruthy()
    const saved = await replay.json()
    expect(saved.events.length).toBeGreaterThan(0)
    if (engine === 'orbit' && arena) {
      const angle = (saved.events.at(-1).value * Math.PI) / 180
      const radius = Math.min(arena.width, arena.height) * 0.32
      expect(pointPosition.x).toBeCloseTo(
        Math.min(0.86, Math.max(0.14, 0.5 + (radius * Math.cos(angle)) / arena.width)),
        2
      )
      expect(pointPosition.y).toBeCloseTo(
        Math.min(0.85, Math.max(0.12, 0.5 + (radius * Math.sin(angle)) / arena.height)),
        2
      )
    }
    expect(saved.ghost.replay).toEqual(saved.events)
    expect(saved.ghost.timeline.at(-1).score).toBe(submitted.run.validatedScore)
    await page.goto(`/archive/replay/${submitted.run.id}`)
    await expect(page.getByLabel('Replay position')).toBeVisible()
    await page.getByRole('button', { name: 'PAUSE', exact: true }).click()
    await page.getByLabel('Replay position').fill(String(Math.round(snapshot.game.durationMs / 2)))
    await page.screenshot({ path: testInfo.outputPath(`${engine}-replay.png`), fullPage: true })
    const next = await page.request.post('/api/game/session', { data: { mode: 'dev', engine } })
    expect(next.ok()).toBeTruthy()
    const withGhost: TGameSnapshot = await next.json()
    expect(withGhost.ghost?.handle).toBe('YOUR GHOST')
    expect(withGhost.ghost?.ghost.replay).toEqual(saved.events)
    await page.evaluate(
      (snapshot) => sessionStorage.setItem('ghost60:session', JSON.stringify(snapshot)),
      withGhost
    )
    await page.goto('/play/run')
    await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'countdown')
    await page.clock.fastForward(3300)
    await advanceTo(page, withGhost.game, saved.events.at(-1).t + 200)
    // Give layout/ResizeObserver changes a paint after the virtual clock leap.
    await page.clock.runFor(50)
    if (engine === 'recall') {
      const drawnGhost = await canvas.evaluate((node) => {
        const canvas = node as HTMLCanvasElement
        const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] === 169 && pixels[i + 1] === 139 && pixels[i + 2] === 255) return true
        return false
      })
      expect(drawnGhost).toBe(true)
    }
    // No current-player input: the saved ghost must still reach its recorded final score.
    await expect(page.locator('.game-race-ghost-name')).toContainText(
      String(submitted.run.validatedScore)
    )
    await page.screenshot({ path: testInfo.outputPath(`${engine}-ghost.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}

test('Shift advances an unanswered expired card and displays the penalty', async ({ page }) => {
  await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  const response = await page.request.post('/api/game/session', {
    data: { mode: 'dev', engine: 'shift' },
  })
  const snapshot = await response.json()
  await page.goto('/dev')
  await page.evaluate(() => localStorage.setItem('ghost60-motion', 'reduced'))
  await page.evaluate(
    (snapshot) => sessionStorage.setItem('ghost60:session', JSON.stringify(snapshot)),
    snapshot
  )
  await page.clock.install()
  await page.goto('/play/run')
  await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'countdown')
  await page.clock.fastForward(3300)
  const first = snapshot.game.config.cards[0]
  await advanceTo(page, snapshot.game, first.presentedMs + first.windowMs + 100)
  await expect(page.getByLabel('Card 1: miss', { exact: true })).toBeVisible()
  await expect(page.getByTestId('action-feedback')).toContainText('TOO LATE')
  await expect(page.getByTestId('action-feedback')).toHaveClass(/action-feedback-static/)
})

test('keyboard users can quit an active game without the game swallowing Enter', async ({
  page,
}) => {
  await page.request.post('/api/auth/sign-in/anonymous', { data: {} })
  const response = await page.request.post('/api/game/session', {
    data: { mode: 'dev', engine: 'pulse' },
  })
  const snapshot = await response.json()
  await page.goto('/dev')
  await page.evaluate(
    (snapshot) => sessionStorage.setItem('ghost60:session', JSON.stringify(snapshot)),
    snapshot
  )
  await page.clock.install()
  await page.goto('/play/run')
  await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'countdown')
  await page.clock.fastForward(3300)
  await page.getByRole('link', { name: 'Quit', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL('http://localhost:3104/')
})
