import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export type TSessionToken = {
  sessionId: string
  userId: string
  dailyGameId: string
  mode: string
  challengeId: string | null
  engineVersion: number
  issuedAt: number
  expiresAt: number
}

function encodeBody(payload: TSessionToken) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

export function signSessionToken(payload: TSessionToken): string {
  const secret = process.env.GAME_SESSION_SECRET
  if (!secret) throw new Error('missing-game-session-secret')
  const body = encodeBody(payload)
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(token: string): TSessionToken | null {
  try {
    const secret = process.env.GAME_SESSION_SECRET
    if (!secret) return null
    const dot = token.indexOf('.')
    if (dot === -1) return null
    const body = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    if (!body || !sig) return null
    const expected = createHmac('sha256', secret).update(body).digest('base64url')
    const a = Buffer.from(sig, 'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TSessionToken
    if (typeof payload.sessionId !== 'string') return null
    if (typeof payload.userId !== 'string') return null
    if (typeof payload.dailyGameId !== 'string') return null
    if (typeof payload.expiresAt !== 'number' || Date.now() > payload.expiresAt) return null
    return payload
  } catch {
    return null
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
