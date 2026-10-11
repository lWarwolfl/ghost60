'use client'

import { useState } from 'react'

export function ChallengeSafetyClient({ handle, slug }: { handle: string; slug: string }) {
  const [mode, setMode] = useState<'idle' | 'blocked' | 'reported' | 'error'>( 'idle')
  const [busy, setBusy] = useState(false)

  const block = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      })
      if (!res.ok) throw new Error('block-failed')
      setMode('blocked')
    } catch {
      setMode('error')
    } finally {
      setBusy(false)
    }
  }

  const report = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectType: 'challenge', subjectKey: slug, reason: 'abuse' })
      })
      if (!res.ok) throw new Error('report-failed')
      setMode('reported')
    } catch {
      setMode('error')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'blocked') return <p className="text-center text-xs text-ghost-muted">Blocked {handle}. Their invites stay hidden from you.</p>
  if (mode === 'reported') return <p className="text-center text-xs text-ghost-muted">Reported. Thanks — moderators review every report.</p>

  return (
    <div className="flex items-center justify-center gap-4 text-xs">
      <button
        type="button"
        onClick={() => void block()}
        disabled={busy}
        className="min-h-11 px-3 text-ghost-muted underline disabled:opacity-50"
      >
        Block sender
      </button>
      <button
        type="button"
        onClick={() => void report()}
        disabled={busy}
        className="min-h-11 px-3 text-ghost-muted underline disabled:opacity-50"
      >
        Report
      </button>
      {mode === 'error' && (
        <span role="alert" className="text-rival-coral">
          Failed. Try again.
        </span>
      )}
    </div>
  )
}
