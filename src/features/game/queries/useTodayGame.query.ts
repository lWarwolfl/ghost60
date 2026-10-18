import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import type { TPublicGame } from '@/features/game/store/game-store'

export async function fetchToday(): Promise<TPublicGame> {
  const res = await fetch('/api/game/today', { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `today-failed-${res.status}`)
  return res.json()
}

const options = {
  queryKey: [QUERY_KEYS.TODAY],
  queryFn: fetchToday,
  retry: 1,
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: 'always' as const,
  refetchOnReconnect: 'always' as const,
  refetchInterval: () => 86400000 - (Date.now() % 86400000) + 50
}

export function useTodayGame() {
  return useQuery(options)
}

export function useTodayGameSuspense() {
  return useSuspenseQuery(options)
}
