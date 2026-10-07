'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { authClient } from '@/lib/auth/client'

export function AnonymousBootstrap() {
  const router = useRouter()

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

  return null
}
