'use client'

import { useEffect, useState } from 'react'

function msToReset(now: number) {
  const d = new Date(now)
  const reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
  return Math.max(0, reset - now)
}

function formatCountdown(ms: number) {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

export function ResetCountdown() {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  if (now === null) return <span className="tnum text-ghost-muted">--:--:--</span>
  return (
    <span className="tnum text-ghost-muted" aria-live="off">
      Resets in {formatCountdown(msToReset(now))} UTC
    </span>
  )
}
