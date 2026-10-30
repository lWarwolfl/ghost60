import { authClient } from '@/lib/auth/client'

let pending: Promise<void> | undefined

// Bootstrap and a fast Play click must share one guest sign-in, so they cannot
// create different anonymous identities and overwrite each other's cookie.
export function ensureSession(): Promise<void> {
  if (pending) return pending
  pending = (async () => {
    const session = await authClient.getSession()
    if (session.error) throw new Error('auth-unavailable')
    if (session.data?.user) return
    const result = await authClient.signIn.anonymous()
    if (result.error) {
      throw new Error(result.error.status === 403 ? 'auth-origin-rejected' : 'auth-unavailable')
    }
  })().finally(() => {
    pending = undefined
  })
  return pending
}
