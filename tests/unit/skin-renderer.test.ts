import { describe, expect, it, vi } from 'vitest'
import { loadSkinCatalog, resolveSkin } from '@/lib/game/skins'
import { drawSkinTrail, getSkinTrailBounds, skinPreviewHistory, visibleSkinPoints } from '@/lib/game/skin-renderer'

describe('skin resolution and drawing', () => {
  it('resolves legacy, unknown and downgraded selections to the free default', () => {
    for (const id of [null, 'clean', 'unknown', 'ultraviolet']) {
      expect(resolveSkin(id, 'free').id).toBe('clean-specter')
    }
    expect(resolveSkin('ultraviolet', 'ghost_plus').id).toBe('ultraviolet')
    expect(resolveSkin('mono', 'free').id).toBe('mono')
  })

  it('bounds malformed tokens, halves reduced trails and caps long exposure', () => {
    const skin = structuredClone(resolveSkin('long-exposure', 'ghost_plus'))
    skin.trail = { ...skin.trail, widthScale: 50, opacity: 9, lifetimeMs: 99999, particleRate: 999 }
    expect(getSkinTrailBounds(skin, false, true)).toEqual({ widthScale: 1.15, opacity: 0.3, lifetimeMs: 650, particles: 20 })
    expect(getSkinTrailBounds(skin, true, true).lifetimeMs).toBe(325)
    skin.trail.widthScale = NaN
    expect(getSkinTrailBounds(skin, false, false).widthScale).toBe(1)
  })

  it('never includes future or insufficiently delayed rival positions', () => {
    const points = Array.from({ length: 200 }, (_, t) => ({ x: t / 200, y: 0.5, t: t * 10 }))
    const before = structuredClone(points)
    expect(visibleSkinPoints(points, 1500, 650, true, 0).at(-1)?.t).toBe(1000)
    expect(visibleSkinPoints(points, 1500, 650, false, 0, 700).at(-1)?.t).toBe(700)
    expect(visibleSkinPoints(points, 100, 650, true)).toEqual([])
    expect(visibleSkinPoints(points, 1990, 99999)).toHaveLength(96)
    expect(points).toEqual(before)
  })

  it('shares a normalized 2.5 second preview and static midpoint', () => {
    expect(skinPreviewHistory(1250)).toEqual(skinPreviewHistory(3750))
    expect(skinPreviewHistory(1250).every((p) => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && p.t <= 1250)).toBe(true)
  })

  it('draws all nine recipes deterministically with balanced context state', () => {
    const operations: unknown[][] = []
    const gradient = { addColorStop: vi.fn() }
    const ctx = new Proxy({}, {
      get: (_, key) => key === 'createLinearGradient' ? () => gradient : (...args: unknown[]) => operations.push([key, ...args]),
      set: (_, key, value) => { operations.push([key, value]); return true }
    }) as CanvasRenderingContext2D
    const recipes = new Set<string>()
    for (const skin of loadSkinCatalog().skins) {
      operations.length = 0
      drawSkinTrail(ctx, { points: skinPreviewHistory(1250), skin, elapsedMs: 1250, width: 200, height: 100, reduced: false })
      expect(operations[0]).toEqual(['save'])
      expect(operations.at(-1)).toEqual(['restore'])
      expect(operations.some((op) => op[0] === 'filter')).toBe(false)
      recipes.add(JSON.stringify(operations))
    }
    expect(recipes.size).toBe(9)
  })
})
