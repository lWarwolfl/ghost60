import { expect, test } from '@playwright/test'
import { recallLayout } from '@/games/recall/table'

// Exercise the actual production runner while isolating this UI regression
// from database/auth availability and daily content rotation.
for (const slotMs of [800, 880])
  test(`Recall at ${slotMs}ms separates WATCH and avoids zero-point spam`, async ({ page }) => {
    const snapshot = {
      token: 'recall-feedback-ui-fixture',
      sessionId: 'recall-ui',
      mode: 'practice',
      expiresAt: '2099-01-01T00:00:00.000Z',
      challenge: null,
      game: {
        id: 'recall-ui',
        gameDate: '2026-10-26',
        gameId: 'recall',
        engineVersion: 1,
        seed: 'recall-ui',
        title: 'MEMORY LEAK',
        instruction: 'Watch, then repeat.',
        durationMs: 50000,
        config: {
          grid: 4,
          ...(slotMs === 880 ? { cellSlotMs: slotMs } : {}),
          sequences: [
            { cells: Array.from({ length: 12 }, (_, i) => i), parMs: 6000 },
            { cells: [12, 13], parMs: 3000 },
            { cells: [15], parMs: 2000 },
          ],
        },
      },
      ghost: {
        handle: 'YOUR GHOST',
        targetScore: 0,
        ghost: {
          gameId: 'recall',
          engineVersion: 1,
          score: 0,
          timeline: [{ t: 900, delta: 0, score: 0 }],
          replay: [{ t: 900, type: 'choice', value: 15 }],
        },
      },
    }
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const body =
        path === '/api/auth/get-session'
          ? {
              user: { id: 'recall-ui', isAnonymous: true },
              session: {
                id: 'recall-ui',
                userId: 'recall-ui',
                expiresAt: '2099-01-01T00:00:00.000Z',
              },
            }
          : path === '/api/game/consume'
            ? { consumed: true }
            : null
      await route.fulfill({ status: body ? 200 : 503, json: body ?? { error: 'isolated-ui-test' } })
    })
    await page.addInitScript(
      (snapshot) => sessionStorage.setItem('ghost60:session', JSON.stringify(snapshot)),
      snapshot
    )
    await page.clock.install()
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100))
    await page.goto('/play/run')
    await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'countdown')
    await page.clock.fastForward(3300)
    await expect(page.getByTestId('active-run')).toHaveAttribute('data-phase', 'running')
    const canvas = page.getByRole('application')
    const advance = async (at: number) => {
      const remaining = parseFloat(await page.locator('.game-timer').innerText()) * 1000
      await page.clock.fastForward(Math.max(1, at - (50000 - remaining)))
      await page.clock.runFor(30)
    }
    const cell = async (index: number) => {
      const size = await canvas.evaluate((node) => ({
        w: (node as HTMLCanvasElement).width,
        h: (node as HTMLCanvasElement).height,
      }))
      const layout = recallLayout(size.w, size.h, 4).cells[index]
      const box = (await canvas.boundingBox())!
      return {
        x: ((layout.x + layout.size / 2) / size.w) * box.width,
        y: ((layout.y + layout.size / 2) / size.h) * box.height,
      }
    }
    const sample = async (index: number) => {
      return canvas.evaluate((node, index) => {
        const canvas = node as HTMLCanvasElement
        const board = Math.min(canvas.width - 32, canvas.height - 32)
        const pitch = board / 4
        const x = (canvas.width - board) / 2 + ((index % 4) + 0.5) * pitch
        const y = (canvas.height - board) / 2 + (Math.floor(index / 4) + 0.5) * pitch
        const data = canvas.getContext('2d')!.getImageData(x - 15, y - 15, 30, 30).data
        let violet = false,
          lit = false
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] === 169 && data[i + 1] === 139 && data[i + 2] === 255) violet = true
          if (data[i] < 150 && data[i + 1] > 200 && data[i + 2] > 170 && data[i + 3] > 60)
            lit = true
        }
        return { violet, lit }
      }, index)
    }
    await advance(950)
    expect((await sample(15)).violet).toBe(false)
    expect((await sample(0)).lit).toBe(true)
    await advance(800 + 12 * slotMs + 50)
    for (let i = 0; i < 12; i++) {
      await canvas.click({ position: await cell(i) })
      if (i < 11) await expect(page.getByTestId('action-feedback')).toHaveCount(0)
      if (i < 11) await page.clock.runFor(100)
    }
    await expect(page.getByTestId('action-feedback')).toContainText('SEQUENCE COMPLETE')
    await expect(page.getByTestId('action-feedback')).toContainText(/\+\d+/)
    await page.clock.runFor(750)
    await expect(page.locator('.game-chip')).toContainText('WATCH')
    expect((await sample(12)).lit).toBe(true)
    expect((await sample(10)).lit).toBe(false)
    await page.clock.runFor(2 * slotMs)
    await canvas.click({ position: await cell(0) })
    await expect(page.getByTestId('action-feedback').last()).toHaveText('MISS')
    await expect(page.getByTestId('action-feedback').last()).not.toContainText('0')
  })
