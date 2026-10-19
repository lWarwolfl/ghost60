import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameIcon } from '@/components/brand/game-icon'
import { Ghost60Mark } from '@/components/brand/ghost60-mark'
import { Ghost60Wordmark } from '@/components/brand/ghost60-wordmark'
import { GhostAvatar } from '@/components/brand/ghost-avatar'
import { RankBadge } from '@/components/brand/rank-badge'
import { StreakWisp } from '@/components/brand/streak-wisp'
import { getBrandMotionSnapshot, subscribeBrandMotion } from '@/lib/hooks/useBrandMotion.hook'
import { loadSkinCatalog } from '@/lib/game/skins'

const css = readFileSync('src/app/globals.css', 'utf8')

afterEach(() => vi.unstubAllGlobals())

describe('vector motion', () => {
  it('ships all sixteen original SVG source files', () => {
    const files = readdirSync('public/vectors', { recursive: true }).filter((file) =>
      String(file).endsWith('.svg')
    )
    expect(files).toHaveLength(16)
    const digest = createHash('sha256')
    for (const file of files.map(String).sort()) {
      digest.update(file.replaceAll('\\', '/'))
      digest.update(readFileSync(path.join('public/vectors', file)))
    }
    expect(digest.digest('hex')).toBe('14d6b1973cff731def38d2f45b9c0f3ee6d972d037deb779c93b97a68301a5d3')
    for (const file of files) {
      const raw = readFileSync(path.join('public/vectors', String(file)), 'utf8')
      expect(raw).toMatch(/^<svg/)
      expect(raw).not.toContain('data-part')
    }
  })

  it('renders every mode with accessible, static-safe geometry and unique references', () => {
    const nodes = [
      ...(['ambient', 'enter', 'success', 'none'] as const).map((motion) =>
        createElement(Ghost60Mark, { motion })
      ),
      ...(['enter', 'none'] as const).map((motion) => createElement(Ghost60Wordmark, { motion })),
      ...(['pulse', 'snap', 'orbit', 'recall', 'shift', 'trace'] as const).flatMap((game) =>
        (['ambient', 'active', 'complete', 'none'] as const).map((motion) =>
          createElement(GameIcon, { game, motion, orbitAngle: 90 })
        )
      ),
      ...loadSkinCatalog().skins.flatMap((skin) =>
        (['idle', 'race', 'win', 'loss', 'none'] as const).map((motion) =>
          createElement(GhostAvatar, { skin: skin.id, motion })
        )
      ),
      ...(['wisp', 'shade', 'haunt', 'specter', 'phantom'] as const).flatMap((rank) =>
        (['ambient', 'enter', 'promote', 'none'] as const).map((motion) =>
          createElement(RankBadge, { rank, motion, previousRank: 'wisp' })
        )
      ),
      ...(['idle', 'increment', 'none'] as const).map((motion) =>
        createElement(StreakWisp, { motion })
      ),
    ]
    const markup = renderToStaticMarkup(createElement('div', null, ...nodes))
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)
    for (const match of markup.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(match[1])
    expect(markup.match(/role="img"/g)).toHaveLength(nodes.length)
    expect(markup).not.toContain('<animate')
    expect(markup).toContain('rotate(-90deg)')
    expect(markup).toContain('Skip specter promotion animation')
  })

  it('retains caller gradient overrides and source geometry', () => {
    const avatar = renderToStaticMarkup(
      createElement(GhostAvatar, { gradient: ['#123456', '#654321'], motion: 'none' })
    )
    expect(avatar).toContain('#123456')
    expect(avatar).toContain('#654321')
    for (const game of ['orbit', 'shift', 'trace', 'recall'] as const) {
      const raw = readFileSync(`public/vectors/games/${game}.svg`, 'utf8')
      const markup = renderToStaticMarkup(createElement(GameIcon, { game, motion: 'none' }))
      for (const match of raw.matchAll(/\bd="([^"]+)"/g)) expect(markup).toContain(match[1])
    }
  })

  it('holds the actual orbit angle at completion and rejects invalid angles', () => {
    const complete = renderToStaticMarkup(
      createElement(GameIcon, { game: 'orbit', motion: 'complete', orbitAngle: 270 })
    )
    expect(complete).toContain('rotate(90deg)')
    const invalid = renderToStaticMarkup(
      createElement(GameIcon, { game: 'orbit', motion: 'active', orbitAngle: Number.NaN })
    )
    expect(invalid).not.toContain('NaN')
  })

  it('keeps promotion center brightening independent from delayed geometry', () => {
    expect(css).not.toMatch(/\[data-motion="promote"\] \[data-part="new-badge"\] \{ animation:/)
    expect(css).toContain('center-brighten 120ms 180ms both')
    expect(css).toContain('draw-line 420ms 300ms both, vector-fade 420ms 300ms both')
  })

  it('moves each SNAP corner toward the center and leaves the TRACE traveler upright', () => {
    expect(css).toMatch(/@keyframes corner-drift \{ 50% \{ transform: scale\(\.925\);/)
    expect(css).toContain('offset-anchor: 0px 0px')
    expect(css).toContain('offset-rotate: 0deg')
    expect(css).toMatch(/\[data-game="recall"\] \[data-part\^="sample-"\] \{ opacity: \.15;/)
  })

  it('responds to OS, app, cross-tab and visibility changes and removes subscriptions', () => {
    const media = Object.assign(new EventTarget(), { matches: false })
    const windowEvents = new EventTarget()
    const documentEvents = new EventTarget()
    let preference = 'system'
    const documentMock = Object.assign(documentEvents, {
      hidden: false,
      documentElement: { dataset: {} as Record<string, string> },
    })
    vi.stubGlobal(
      'window',
      Object.assign(windowEvents, {
        matchMedia: () => media,
        localStorage: { getItem: () => preference },
      })
    )
    vi.stubGlobal('document', documentMock)
    const notify = vi.fn()
    const unsubscribe = subscribeBrandMotion(notify)
    expect(getBrandMotionSnapshot()).toBe('false:false')
    preference = 'full'
    media.matches = true
    media.dispatchEvent(new Event('change'))
    expect(getBrandMotionSnapshot()).toBe('true:false')
    expect(documentMock.documentElement.dataset.reducedMotion).toBe('true')
    media.matches = false
    preference = 'reduced'
    windowEvents.dispatchEvent(new Event('ghost60:prefs'))
    expect(getBrandMotionSnapshot()).toBe('true:false')
    preference = 'full'
    windowEvents.dispatchEvent(new Event('storage'))
    expect(getBrandMotionSnapshot()).toBe('false:false')
    documentMock.hidden = true
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    expect(getBrandMotionSnapshot()).toBe('false:true')
    expect(documentMock.documentElement.dataset.motionPaused).toBe('true')
    unsubscribe()
    notify.mockClear()
    media.dispatchEvent(new Event('change'))
    windowEvents.dispatchEvent(new Event('storage'))
    windowEvents.dispatchEvent(new Event('ghost60:prefs'))
    documentEvents.dispatchEvent(new Event('visibilitychange'))
    expect(notify).not.toHaveBeenCalled()
  })

  it('falls back safely when browser storage is blocked', () => {
    vi.stubGlobal('window', {
      localStorage: { getItem: () => { throw new Error('blocked') } },
      matchMedia: () => ({ matches: true }),
    })
    vi.stubGlobal('document', { hidden: true })
    expect(getBrandMotionSnapshot()).toBe('true:true')
  })

  it('covers static motion, reduced-motion fallbacks and hidden-tab pause without animation JS', () => {
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).toContain('animation-play-state: paused !important')
    expect(css).toContain('animation: vector-fade 120ms both !important')
    expect(css).toContain('[data-reduced-motion="true"] * { animation: none !important')
    expect(css).toContain('.brand-vector[data-motion="none"] * { animation: none !important')
    expect(css).toContain('trace-travel 3.8s')
    expect(css).toContain('recall-sample 2580ms')
    expect(css).toContain('scan-bands 1s linear infinite')
  })
})
