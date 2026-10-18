'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth/client'

export function DangerZoneClient() {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    if (!confirm) {
      setConfirm(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'delete-failed')
      await authClient.signOut()
      router.push('/')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete-failed')
      setBusy(false)
      setConfirm(false)
    }
  }

  return (
    <section
      aria-label="Delete account"
      className="rounded-card border-rival-coral/40 bg-ink-900 border p-5"
    >
      <h2 className="font-display font-800 text-lg">Delete account</h2>
      <p className="text-ghost-muted mt-1 text-sm leading-6">
        Removes your profile, runs, streak, XP, league memberships and challenges. Your sent
        challenge links stop working. Aggregate daily percentiles keep only anonymous counts.
        Deletion cancels any linked subscription before removing your data. This cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="rounded-control border-rival-coral/60 font-600 text-rival-coral mt-3 flex min-h-12 w-full items-center justify-center border px-5 text-sm disabled:opacity-50"
      >
        {busy ? 'DELETING…' : confirm ? 'TAP AGAIN TO CONFIRM DELETION' : 'DELETE MY ACCOUNT'}
      </button>
      {error && (
        <p role="alert" className="text-rival-coral mt-2 text-sm">
          {error === 'rate-limited'
            ? 'Too many attempts. Try again tomorrow.'
            : error === 'subscription-cancel-failed'
              ? 'Subscription cancellation failed. Your data was kept; try again or manage billing from Ghost+.'
              : 'Could not delete. Try again.'}
        </p>
      )}
    </section>
  )
}
