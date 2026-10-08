import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TMyLeague = {
  slug: string
  name: string
  isOwner: boolean
  memberCount: number
  url: string
}

async function fetchMyLeagues(): Promise<{ leagues: TMyLeague[] }> {
  const res = await fetch('/api/leagues')
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'leagues-failed')
  return res.json()
}

export function useMyLeagues() {
  return useQuery({ queryKey: [QUERY_KEYS.LEAGUES], queryFn: fetchMyLeagues, retry: 1 })
}

export function useMyLeaguesSuspense() {
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.LEAGUES], queryFn: fetchMyLeagues, retry: 1 })
}
