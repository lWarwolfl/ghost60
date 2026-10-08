'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { fetchToday } from '@/features/game/queries/useTodayGame.query'

function idle(fn: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(fn)
    return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
  }
  const t = setTimeout(fn, 800)
  return () => clearTimeout(t)
}

export function PrefetchGame() {
  const client = useQueryClient()
  useEffect(
    () =>
      idle(() => {
        void client.prefetchQuery({ queryKey: [QUERY_KEYS.TODAY], queryFn: fetchToday, staleTime: 5 * 60 * 1000 })
      }),
    [client]
  )
  return null
}
