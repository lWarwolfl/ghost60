'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth/client'

export function GoogleSignIn() {
  const { data: session, isPending } = authClient.useSession()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setError(null)
    setPending(true)
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/profile' })
      if (result.error)
        throw new Error(result.error.message ?? 'Could not sign in. Please try again.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not sign in. Please try again.')
    } finally {
      setPending(false)
    }
  }

  if (session?.user && !session.user.isAnonymous) {
    return <p className="text-ghost-muted text-sm break-all">Signed in as {session.user.email}</p>
  }

  return (
    <section
      aria-label="Save your account"
      className="rounded-card bg-surface-800 border border-white/10 p-5"
    >
      <p className="text-ghost-muted mb-3 text-sm">
        Keep your guest progress and access your account on other devices.
      </p>
      <button
        type="button"
        disabled={isPending || pending}
        onClick={signIn}
        className="rounded-control border-spectral-cyan/50 font-600 text-spectral-cyan min-h-12 w-full border px-4 text-sm disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && (
        <p role="alert" className="text-rival-coral mt-2 text-sm">
          {error}
        </p>
      )}
    </section>
  )
}
