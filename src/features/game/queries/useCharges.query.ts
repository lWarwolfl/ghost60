import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { authClient } from '@/lib/auth/client'

export type TCharges = {
  limit: number | null
  remaining: number | null
  used: number
  resetAt: string
  rankedAvailable: boolean
  plan: 'free' | 'ghost_plus'
}

async function fetchCharges(): Promise<TCharges> {
  const res = await fetch('/api/game/charges', { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'charges-failed')
  return res.json()
}

const options = (userId?: string) => ({
  queryKey: [QUERY_KEYS.CHARGES, userId],
  queryFn: () => userId ? fetchCharges() : Promise.resolve(null),
  retry: 1,
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: 'always' as const,
  refetchOnReconnect: 'always' as const,
  refetchInterval: () => 86400000 - (Date.now() % 86400000) + 50
})

export function useCharges() {
  const { data } = authClient.useSession()
  return useQuery({ ...options(data?.user.id), enabled: Boolean(data?.user) })
}

export function useChargesSuspense() {
  const { data } = authClient.useSession()
  return useSuspenseQuery(options(data?.user.id))
}
