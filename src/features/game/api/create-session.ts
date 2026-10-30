import { ensureSession } from '@/lib/auth/ensure-session'
import type { TGameSnapshot } from '@/features/game/store/game-store'
import type { TSessionRequest } from '@/features/game/schemas/session.schema'

export async function createSession(request: TSessionRequest): Promise<TGameSnapshot> {
  const send = () =>
    fetch('/api/game/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  let res = await send()
  if (res.status === 401) {
    await ensureSession()
    res = await send()
  }
  const data = await res.json().catch(() => null)
  if (!res.ok)
    throw new Error(data?.error ?? (res.status === 401 ? 'unauthorized' : 'session-unavailable'))
  if (!data?.token || !data?.game) throw new Error('session-unavailable')
  return data
}

export function sessionStartMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : ''
  const messages: Record<string, string> = {
    'charges-empty': 'No runs left today. Runs reset at 00:00 UTC; Ghost+ is unlimited.',
    'auth-origin-rejected':
      'Guest sign-in is blocked on this deployment. Its authentication URL needs to be configured.',
    'auth-unavailable': 'Couldn’t connect to guest sign-in. Check your connection and try again.',
    unauthorized: 'Your sign-in expired. Refresh the page and try again.',
    'special-ended': 'This Flash game ended. Refresh to play the next one.',
    'rate-limited': 'Too many starts at once. Wait a minute and try again.',
    'ghost-plus-locked': 'Ghost+ is required to play this game.',
    'already-attempted':
      'You already raced this ghost. Send a revenge challenge from your result instead.',
    'challenge-unavailable': 'This challenge is no longer available.',
    'game-unavailable': 'This game is no longer available. Refresh to see current games.',
    'bad-game-config': 'This game could not load its settings. Please try another game.',
  }
  return messages[code] ?? 'Couldn’t start the game. Check your connection and try again.'
}
