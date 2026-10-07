import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import type { TPublicGame } from '@/features/game/store/game-store'

async function fetchToday(): Promise<TPublicGame> {
  const res = await fetch('/api/game/today')
  if (!res.ok) throw new Error('no-game-today')
  return res.json()
}

export function useTodayGame() {
  return useQuery({ queryKey: [QUERY_KEYS.TODAY], queryFn: fetchToday, retry: 1 })
}

export function useTodayGameSuspense() {
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.TODAY], queryFn: fetchToday, retry: 1 })
}
