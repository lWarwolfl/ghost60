import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { canEquip, freeSkins, getSkin, loadSkinCatalog } from '@/lib/game/skins'

const catalog = loadSkinCatalog()

describe('ghost+ lock invariants (no billing this phase)', () => {
  it('ships zero stripe wiring', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies).not.toHaveProperty('stripe')
    const apiFiles: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (e.name === 'route.ts') apiFiles.push(full)
      }
    }
    walk(path.join(process.cwd(), 'src', 'app', 'api'))
    expect(apiFiles.some((f) => f.includes('billing') || f.includes('stripe') || f.includes('webhook'))).toBe(false)
  })
})

describe('skin catalog', () => {
  it('offers free skins and locks premium behind ghost_plus', () => {
    expect(freeSkins().length).toBeGreaterThanOrEqual(1)
    expect(getSkin('clean-specter')?.entitlement).toBe('free')
    expect(getSkin('ultraviolet')?.entitlement).toBe('ghost_plus')
    expect(getSkin('nope')).toBeNull()
    expect(canEquip('free', 'clean-specter')).toBe(true)
    expect(canEquip('free', 'ultraviolet')).toBe(false)
    expect(canEquip('ghost_plus', 'ultraviolet')).toBe(true)
    expect(canEquip('free', 'nope')).toBe(false)
  })
  it('keeps every skin inside the fairness bounds', () => {
    const b = catalog.fairnessBounds
    for (const s of catalog.skins) {
      expect(s.trail.widthScale).toBeGreaterThanOrEqual(b.rivalTrailWidthScale[0])
      expect(s.trail.widthScale).toBeLessThanOrEqual(b.rivalTrailWidthScale[1])
      expect(s.trail.opacity).toBeGreaterThanOrEqual(b.rivalTrailOpacity[0])
      expect(s.trail.opacity).toBeLessThanOrEqual(b.rivalTrailOpacity[1])
      expect(s.trail.lifetimeMs).toBeGreaterThanOrEqual(b.activeGameplayLifetimeMs[0])
      expect(s.trail.lifetimeMs).toBeLessThanOrEqual(b.activeGameplayLifetimeMs[1])
      expect(s.trail.particleRate).toBeLessThanOrEqual(b.maxVisibleParticles)
    }
  })
})
