'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics/track'
import type { TAnalyticsEvent } from '@/lib/game/analytics'

export function TrackView({ name, props }: { name: TAnalyticsEvent; props?: Record<string, unknown> }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    track(name, props)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])
  return null
}
