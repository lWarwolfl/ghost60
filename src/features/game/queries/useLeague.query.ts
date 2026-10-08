import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TLeagueStanding = {
  handle: string
  displayName: string | null
  avatarKey: string
  role: string
  isOwner: boolean
  total: number
  daysPlayed: number
  todayCompleted: boolean
  streak: number
  dailyPoints: number[]
  latestRivalry: { outcome: string; at: string } | null
}

export type TLeagueDetail = {
  slug: string
  name: string
  isOwner: boolean
  isMember: boolean
  memberCount: number
  week: { start: string; end: string; dates: string[] }
  standings: TLeagueStanding[]
  url: string
}

async function fetchLeague(slug: string): Promise<TLeagueDetail> {
  const res = await fetch(`/api/leagues/${slug}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'league-failed')
  return res.json()
}

export function useLeague(slug: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.LEAGUES, slug],
    queryFn: () => fetchLeague(slug),
    retry: 1
  })
}

export function useLeagueSuspense(slug: string) {
  return useSuspenseQuery({
    queryKey: [QUERY_KEYS.LEAGUES, slug],
    queryFn: () => fetchLeague(slug),
    retry: 1
  })
}
