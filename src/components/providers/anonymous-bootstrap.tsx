'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authClient } from '@/lib/auth/client'
import { flushPending } from '@/lib/game/pending-store'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export function AnonymousBootstrap() {
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await authClient.getSession()
      if (cancelled || data?.user) return
      await authClient.signIn.anonymous()
      if (!cancelled) router.refresh()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    const flush = () => {
      void flushPending().then((synced) => {
        if (!synced) return
        for (const key of [QUERY_KEYS.RUNS, QUERY_KEYS.PROFILE, QUERY_KEYS.CHARGES, QUERY_KEYS.ARCHIVE]) {
          void queryClient.invalidateQueries({ queryKey: [key] })
        }
      })
    }
    const timer = setTimeout(flush, 1500)
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush()
    }
    window.addEventListener('online', flush)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', flush)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [queryClient])

  return null
}
