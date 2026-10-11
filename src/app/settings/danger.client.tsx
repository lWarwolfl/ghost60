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
    <section aria-label="Delete account" className="rounded-card border border-rival-coral/40 bg-ink-900 p-5">
      <h2 className="font-display text-lg font-800">Delete account</h2>
      <p className="mt-1 text-sm leading-6 text-ghost-muted">
        Removes your profile, runs, streak, XP, league memberships and challenges. Your sent
        challenge links stop working. Aggregate daily percentiles keep only anonymous counts.
        This cannot be undone.
      </p>
      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-control border border-rival-coral/60 px-5 text-sm font-600 text-rival-coral disabled:opacity-50"
      >
        {busy ? 'DELETING…' : confirm ? 'TAP AGAIN TO CONFIRM DELETION' : 'DELETE MY ACCOUNT'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rival-coral">
          {error === 'rate-limited' ? 'Too many attempts. Try again tomorrow.' : 'Could not delete. Try again.'}
        </p>
      )}
    </section>
  )
}
