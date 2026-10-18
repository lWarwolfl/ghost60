import { afterEach, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  canvas: null as unknown,
  reduced: false
}))
vi.mock('react', () => ({
  useRef: () => ({ current: state.canvas }),
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect)
}))
vi.mock('@/lib/hooks/useReducedMotion.hook', () => ({ useReducedMotion: () => state.reduced }))
vi.mock('@/lib/game/skin-renderer', () => ({
  drawSkinTrail: vi.fn(), drawSkinAvatar: vi.fn(),
  skinPreviewHistory: () => [{ x: 0.5, y: 0.5, t: 1250 }]
}))
import { SkinPreview } from '@/components/game/skin-preview'
import { drawSkinTrail } from '@/lib/game/skin-renderer'
import { resolveSkin } from '@/lib/game/skins'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  state.effects = []
  state.reduced = false
})

it('shares one clock, animates at most two mobile cards and pauses hidden/offscreen previews', () => {
  const callbacks = new Map<number, (time: number) => void>()
  const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = []
  const listeners = new Map<string, () => void>()
  const document = { hidden: false, addEventListener: (key: string, fn: () => void) => listeners.set(key, fn), removeEventListener: vi.fn() }
  let id = 0
  vi.stubGlobal('React', { createElement: vi.fn() })
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', { devicePixelRatio: 1, matchMedia: () => ({ matches: true }), addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('navigator', { hardwareConcurrency: 4 })
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => { callbacks.set(++id, cb); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => callbacks.delete(key))
  vi.stubGlobal('IntersectionObserver', class {
    constructor(fn: (entries: Array<{ isIntersecting: boolean }>) => void) { observers.push(fn) }
    observe() {}
    disconnect() {}
  })
  const render = () => {
    state.canvas = { width: 200, height: 96, getContext: () => ({ setTransform: vi.fn(), clearRect: vi.fn() }) }
    SkinPreview({ skin: resolveSkin('mono') })
    const cleanup = state.effects.pop()?.()
    if (cleanup) cleanups.push(cleanup)
  }
  const tick = (time: number) => {
    const [key, callback] = [...callbacks.entries()][0]
    callbacks.delete(key)
    callback(time)
  }
  for (let i = 0; i < 4; i += 1) render()
  for (const observe of observers) observe([{ isIntersecting: true }])
  vi.mocked(drawSkinTrail).mockClear()
  expect(callbacks.size).toBe(1)
  tick(100)
  expect(drawSkinTrail).toHaveBeenCalledTimes(2)
  observers[0]([{ isIntersecting: false }])
  vi.mocked(drawSkinTrail).mockClear()
  tick(116)
  expect(drawSkinTrail).toHaveBeenCalledTimes(2)
  document.hidden = true
  listeners.get('visibilitychange')?.()
  expect(callbacks.size).toBe(0)
  document.hidden = false
  listeners.get('visibilitychange')?.()
  expect(callbacks.size).toBe(1)
  for (const observe of observers) observe([{ isIntersecting: false }])
  vi.mocked(drawSkinTrail).mockClear()
  tick(132)
  expect(drawSkinTrail).not.toHaveBeenCalled()
  expect(callbacks.size).toBe(0)
  state.reduced = true
  render()
  observers.at(-1)?.([{ isIntersecting: true }])
  expect(drawSkinTrail).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ reduced: true, elapsedMs: 1250 }))
  vi.mocked(drawSkinTrail).mockClear()
  tick(148)
  expect(drawSkinTrail).not.toHaveBeenCalled()
  expect(callbacks.size).toBe(0)
})
