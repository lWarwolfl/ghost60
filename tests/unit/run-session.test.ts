import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const harness = vi.hoisted(() => ({ effects: [] as Array<() => void | (() => void)>, setters: [] as ReturnType<typeof vi.fn>[], submit: vi.fn(), pending: vi.fn(), save: vi.fn(), clear: vi.fn() }))
vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => { const setter = vi.fn(); harness.setters.push(setter); return [initial, setter] },
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect) },
  useMemo: (factory: () => unknown) => factory(),
  useCallback: (callback: unknown) => callback
}))
vi.mock('@/features/game/mutations/useSubmitRun.mutation', () => ({ useSubmitRun: () => ({ mutateAsync: harness.submit }) }))
vi.mock('@/lib/game/pending-store', () => ({ loadPending: harness.pending, savePending: harness.save, clearPending: harness.clear }))
vi.mock('@/lib/hooks/useReducedMotion.hook', () => ({ useReducedMotion: () => true }))
vi.mock('@/lib/hooks/useEquippedSkin.hook', () => ({ useEquippedSkin: () => ({ id: 'mono' }) }))
vi.mock('@/features/game/store/game-store', () => ({ useGameStore: () => undefined }))
vi.mock('@/lib/game/audio', () => ({ audio: { tick: vi.fn(), go: vi.fn(), finish: vi.fn(), win: vi.fn() } }))

import { useRunSession } from '@/features/game/hooks/useRunSession.hook'
import type { TPublicGame } from '@/features/game/store/game-store'

const game: TPublicGame = { id: 'daily', gameDate: '2026-10-19', gameId: 'pulse', engineVersion: 1, seed: 'seed', config: {}, title: 'test', instruction: 'tap', durationMs: 10000 }
let storage: Map<string, string>
let cleanup: Array<() => void>
function useMountedSession(ready = true) {
  const session = useRunSession(game, 'token', ready)
  cleanup.push(...harness.effects.map(effect => effect()).filter((effect): effect is () => void => typeof effect === 'function'))
  return session
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  harness.effects = []
  harness.setters = []
  harness.pending.mockResolvedValue(undefined)
  harness.save.mockResolvedValue(undefined)
  harness.clear.mockResolvedValue(undefined)
  harness.submit.mockResolvedValue({ run: { id: 'run', validatedScore: 0, valid: true }, outcome: null })
  storage = new Map()
  const events = { addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('window', { ...events, sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } })
  vi.stubGlobal('document', { ...events, visibilityState: 'visible' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ consumed: true }) }))
  cleanup = []
})

afterEach(() => {
  cleanup.forEach(stop => stop())
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('run session lifecycle', () => {
  it('starts an unconsumed resumed session with the entire countdown and consumes at actual play +3s', async () => {
    const session = useMountedSession()
    await vi.advanceTimersByTimeAsync(5999)
    expect(fetch).not.toHaveBeenCalled()
    expect(session.getElapsed()).toBe(2999)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(storage.get('ghost60:consumed:token')).toBe('1')
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('consumes first input immediately and rejects countdown and duration-boundary events', async () => {
    const session = useMountedSession()
    await vi.advanceTimersByTimeAsync(1000)
    expect(session.logEvent({ type: 'tap' })).toBe(-1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(session.logEvent({ type: 'tap' })).toBe(0)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10000)
    expect(session.logEvent({ type: 'tap' })).toBe(-1)
    await vi.advanceTimersByTimeAsync(120)
    expect(harness.submit).toHaveBeenCalledTimes(1)
    expect(harness.submit).toHaveBeenCalledWith({ token: 'token', events: [{ type: 'tap', t: 0 }], visibilityInterruptions: 0 })
  })

  it('holds the countdown and the charge until the runner is mounted', async () => {
    const session = useMountedSession(false)
    await vi.advanceTimersByTimeAsync(20000)
    expect(fetch).not.toHaveBeenCalled()
    expect(session.getElapsed()).toBe(0)
    expect(session.logEvent({ type: 'tap' })).toBe(-1)
  })

  it('does not restart a locally consumed token after reload', async () => {
    storage.set('ghost60:consumed:token', '1')
    const session = useMountedSession()
    await vi.advanceTimersByTimeAsync(20000)
    expect(harness.setters[0]).toHaveBeenCalledWith('error')
    expect(session.logEvent({ type: 'tap' })).toBe(-1)
    expect(harness.submit).not.toHaveBeenCalled()
  })

  it('retries an offline automatic consume on the live clock', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    useMountedSession()
    await vi.advanceTimersByTimeAsync(6000)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('cleans up before async initialization without starting timers or consuming', async () => {
    const session = useMountedSession()
    cleanup.forEach(stop => stop())
    await vi.advanceTimersByTimeAsync(20000)
    expect(session.logEvent({ type: 'tap' })).toBe(-1)
    expect(fetch).not.toHaveBeenCalled()
    expect(harness.submit).not.toHaveBeenCalled()
  })

  it('restores a saved completed run before checking the consumed marker', async () => {
    storage.set('ghost60:consumed:token', '1')
    harness.pending.mockResolvedValue({ token: 'token', events: [{ type: 'tap', t: 1 }], visibilityInterruptions: 2 })
    useMountedSession()
    await vi.advanceTimersByTimeAsync(20000)
    expect(harness.submit).toHaveBeenCalledTimes(1)
    expect(harness.submit).toHaveBeenCalledWith({ token: 'token', events: [{ type: 'tap', t: 1 }], visibilityInterruptions: 2 })
    expect(fetch).not.toHaveBeenCalled()
  })
})
