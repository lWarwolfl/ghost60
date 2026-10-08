import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import type { TPublicGame } from '@/features/game/store/game-store'

export async function fetchToday(): Promise<TPublicGame> {
  const res = await fetch('/api/game/today')
  if (!res.ok) throw new Error('no-game-today')
  return res.json()
}

const TODAY_STALE_MS = 5 * 60 * 1000

export function useTodayGame() {
  return useQuery({ queryKey: [QUERY_KEYS.TODAY], queryFn: fetchToday, retry: 1, staleTime: TODAY_STALE_MS })
}

export function useTodayGameSuspense() {
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.TODAY], queryFn: fetchToday, retry: 1, staleTime: TODAY_STALE_MS })
}
