'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTION_FEEDBACK_MS, signedPoints } from '@/lib/game/gameplay-motion'

type TFeedback = {
  id: number
  x: number
  y: number
  delta: number
  label?: string
  showPoints?: boolean
}

export function useActionFeedback() {
  const [entries, setEntries] = useState<TFeedback[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer)
    },
    []
  )
  const show = useCallback((entry: Omit<TFeedback, 'id'>) => {
    const id = nextId.current++
    setEntries((previous) => [...previous.slice(-11), { ...entry, id }])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setEntries((previous) => previous.filter((item) => item.id !== id))
    }, ACTION_FEEDBACK_MS)
    timers.current.add(timer)
  }, [])
  return { entries, show }
}

export function ActionFeedback({ entries, reduced }: { entries: TFeedback[]; reduced: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-live="polite"
      aria-atomic="false"
    >
      {entries.map((entry) => (
        <span
          key={entry.id}
          data-testid="action-feedback"
          className={`action-feedback ${reduced ? 'action-feedback-static' : ''}`}
          style={{
            left: `${Math.min(86, Math.max(14, entry.x * 100))}%`,
            top: `${Math.min(85, Math.max(12, entry.y * 100))}%`,
            color: entry.delta > 0 ? '#c7ff5e' : entry.delta < 0 ? '#ff668f' : '#f5f7ff',
          }}
        >
          {entry.showPoints === false ? entry.label : signedPoints(entry.delta)}
          {entry.label && entry.showPoints !== false ? <small>{entry.label}</small> : null}
        </span>
      ))}
    </div>
  )
}
