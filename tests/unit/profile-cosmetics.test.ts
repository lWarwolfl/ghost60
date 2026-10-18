import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  plan: 'free',
  user: { id: 'owner' } as { id: string } | null,
  rows: [] as object[][],
  write: vi.fn(),
  allowed: true
}))
vi.mock('@/lib/auth/server', () => ({ getCurrentUser: async () => state.user }))
vi.mock('@/lib/game/entitlement', () => ({ getPlan: async () => state.plan }))
vi.mock('@/lib/game/rate-limit', () => ({
  RATE_LIMITS: { profileWrite: {} },
  checkRateLimit: async () => state.allowed,
  rateLimitedResponse: () => new Response(null, { status: 429 })
}))
vi.mock('@/drizzle', () => ({ db: {
  select: () => ({ from: () => ({ where: () => {
    const rows = state.rows.shift() ?? []
    return Object.assign(Promise.resolve(rows), { orderBy: () => ({ limit: async () => rows }) })
  } }) }),
  insert: () => ({ values: (values: unknown) => ({ onConflictDoUpdate: async () => state.write(values) }) })
} }))
import { GET } from '@/app/api/profile/route'
import { PATCH } from '@/app/api/profile/cosmetics/route'

const request = (skinId: string, slot = 'ghost') => new Request('http://localhost/api/profile/cosmetics', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skinId, slot })
})
afterEach(() => {
  state.plan = 'free'
  state.user = { id: 'owner' }
  state.rows = []
  state.allowed = true
  vi.clearAllMocks()
})

describe('profile cosmetics entitlement boundary', () => {
  it('shows paid users every skin unlocked and keeps their equipped premium selections', async () => {
    state.plan = 'ghost_plus'
    state.rows = [[{ activeGhostSkin: 'ultraviolet', activeCardSkin: 'scanline' }]]
    const data = await (await GET()).json()
    expect(data.plan).toBe('ghost_plus')
    expect(data.cosmetics.catalog).toHaveLength(9)
    expect(data.cosmetics.catalog.every((s: { unlocked: boolean }) => s.unlocked)).toBe(true)
    expect(data.cosmetics.equipped).toEqual({ ghost: 'ultraviolet', card: 'scanline' })
  })

  it('normalizes expired paid and legacy selections without leaking an active premium skin', async () => {
    state.rows = [[{ activeGhostSkin: 'ultraviolet', activeCardSkin: 'clean' }]]
    const data = await (await GET()).json()
    expect(data.cosmetics.equipped).toEqual({ ghost: 'clean-specter', card: 'clean-specter' })
    expect(data.profile.activeGhostSkin).toBe('clean-specter')
    expect(data.cosmetics.catalog.filter((s: { unlocked: boolean }) => s.unlocked)).toHaveLength(3)
  })

  it('rejects tampered premium, unknown skins, bad slots and anonymous writes', async () => {
    expect((await PATCH(request('ultraviolet'))).status).toBe(403)
    expect((await PATCH(request('missing'))).status).toBe(404)
    expect((await PATCH(request('mono', 'target'))).status).toBe(400)
    state.user = null
    expect((await PATCH(request('mono'))).status).toBe(401)
    expect(state.write).not.toHaveBeenCalled()
  })

  it('equips either slot for paid users and reads back the normalized saved target', async () => {
    state.plan = 'ghost_plus'
    state.rows = [[{ activeGhostSkin: 'mono', activeCardSkin: 'scanline' }]]
    const response = await PATCH(request('scanline', 'card'))
    expect(response.status).toBe(200)
    expect(state.write).toHaveBeenCalledWith({ userId: 'owner', activeCardSkin: 'scanline' })
    expect((await response.json()).profile).toEqual({ activeGhostSkin: 'mono', activeCardSkin: 'scanline' })
  })

  it('keeps free equip available and rate limits writes', async () => {
    state.rows = [[{ activeGhostSkin: 'mono', activeCardSkin: 'clean' }]]
    expect((await PATCH(request('mono'))).status).toBe(200)
    expect(state.write).toHaveBeenCalledOnce()
    state.allowed = false
    expect((await PATCH(request('mono'))).status).toBe(429)
    expect(state.write).toHaveBeenCalledOnce()
  })
})
