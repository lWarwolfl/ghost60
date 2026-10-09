import fs from 'node:fs'
import path from 'node:path'

export type TSkinEntitlement = 'free' | 'ghost_plus'

export type TSkin = {
  id: string
  name: string
  entitlement: TSkinEntitlement
  trail: {
    primary: string
    secondary: string
    widthScale: number
    opacity: number
    lifetimeMs: number
    particleRate: number
    blend: string
    dash?: number[]
  }
  avatar: { gradient: [string, string]; rim: string; effect: string }
  resultCard: { accent: string; backgroundEffect: string }
}

export type TSkinCatalog = {
  version: number
  fairnessBounds: {
    rivalTrailWidthScale: [number, number]
    rivalTrailOpacity: [number, number]
    activeGameplayLifetimeMs: [number, number]
    maxVisibleParticles: number
    noTargetLikeShapes: boolean
    noGameplaySoundBySkin: boolean
  }
  skins: TSkin[]
}

let cached: TSkinCatalog | null = null

export function loadSkinCatalog(): TSkinCatalog {
  if (!cached) {
    cached = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'skin-catalog.json'), 'utf8')) as TSkinCatalog
  }
  return cached
}

export function getSkin(id: string): TSkin | null {
  return loadSkinCatalog().skins.find((s) => s.id === id) ?? null
}

export function freeSkins(): TSkin[] {
  return loadSkinCatalog().skins.filter((s) => s.entitlement === 'free')
}

export function canEquip(plan: string, skinId: string): boolean {
  const skin = getSkin(skinId)
  if (!skin) return false
  if (skin.entitlement === 'free') return true
  return plan === 'ghost_plus'
}
