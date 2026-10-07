import { describe, expect, it } from 'vitest'
import { hashToken, signSessionToken, verifySessionToken } from '@/lib/game/token'

process.env.GAME_SESSION_SECRET = process.env.GAME_SESSION_SECRET ?? 'unit-test-secret'

const BASE = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  dailyGameId: '22222222-2222-4222-8222-222222222222',
  mode: 'ranked',
  challengeId: null,
  engineVersion: 1,
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3600000
}

describe('session token', () => {
  it('round-trips a signed payload', () => {
    const token = signSessionToken(BASE)
    expect(verifySessionToken(token)).toMatchObject({ sessionId: BASE.sessionId, userId: 'user-1' })
  })
  it('rejects tampered and expired tokens', () => {
    const token = signSessionToken(BASE)
    const [body] = token.split('.')
    expect(verifySessionToken(`${body}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`)).toBeNull()
    expect(verifySessionToken('not-a-token')).toBeNull()
    const expired = signSessionToken({ ...BASE, expiresAt: Date.now() - 1000 })
    expect(verifySessionToken(expired)).toBeNull()
  })
  it('hashes deterministically', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'))
    expect(hashToken('abc')).toHaveLength(64)
  })
})
