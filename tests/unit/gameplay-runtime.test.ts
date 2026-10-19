import { describe, expect, it, vi } from 'vitest'
import { consumptionRequest, runClock, traceFeedback } from '@/lib/game/gameplay-motion'
import { traceEngine } from '@/games/trace/engine'

describe('gameplay runtime safeguards', () => {
  it('consumes after three actual play seconds, not session creation or countdown', () => {
    expect(runClock(2999, 3000, 40000)).toMatchObject({ running: false, consume: false })
    expect(runClock(5999, 3000, 40000)).toMatchObject({ running: true, consume: false })
    expect(runClock(6000, 3000, 40000)).toMatchObject({ running: true, consume: true })
    expect(runClock(50000, 3000, 40000)).toEqual({ running: false, consume: true, finished: true, elapsed: 40000 })
  })

  it('retries failed HTTP and offline consumes without treating them as spent acknowledgements', async () => {
    const request = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ consumed: true }))
    const consume = consumptionRequest('authorized-token', request)
    expect(await consume()).toBe(false)
    expect(await consume()).toBe(false)
    expect(await consume()).toBe(true)
    expect(await consume()).toBe(true)
    expect(request).toHaveBeenCalledTimes(3)
    expect(request.mock.calls[0][1]).toMatchObject({ keepalive: true, body: JSON.stringify({ token: 'authorized-token' }) })
  })

  it('shares an in-flight consume and retries malformed acknowledgements', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('bad-json')).mockResolvedValueOnce(Response.json({ consumed: true }))
    const consume = consumptionRequest('token', request)
    const first = consume()
    expect(consume()).toBe(first)
    expect(await first).toBe(false)
    expect(await consume()).toBe(true)
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('keeps precision and ordered gates identical to authoritative trace scoring across strokes', () => {
    const config = { gates: [{ x: 1000, y: 1000, r: 200 }, { x: 9000, y: 1000, r: 200 }], corridorHalf: 500, completionBonus: 500 }
    const events = [
      { t: 0, type: 'pointer_down' as const, p: { x: 9000, y: 1000 } },
      { t: 10, type: 'pointer_up' as const, p: { x: 1000, y: 1000 } },
      { t: 20, type: 'pointer_down' as const, p: { x: 5000, y: 1600 } },
      { t: 30, type: 'pointer_up' as const, p: { x: 9000, y: 1000 } }
    ]
    const feedback = traceFeedback(config, events)
    const score = traceEngine.scoreRun({ seed: 'same', config, events, visibilityInterruptions: 0 })
    expect(feedback.gateTimes).toEqual([10, 30])
    expect(feedback.precision).toBe(score.metrics.precision)
    expect(feedback.passed).toBe(score.metrics.passed)
    expect(feedback.samples[2]).toMatchObject({ down: true, band: 'outside' })
    expect(traceFeedback(config, []).precision).toBe(0)
  })
})
