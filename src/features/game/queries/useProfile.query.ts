import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TProfile = {
  profile: { handle: string | null; displayName: string | null } | null
  streak: { currentCount: number; longestCount: number; graceTokens: number } | null
  xpTotal: number
  level: { level: number; intoLevel: number; need: number }
  achievements: Array<{ achievementId: string; detail: { title: string; description: string } | null }>
  recentRuns: Array<{
    id: string
    mode: string
    validatedScore: number
    valid: boolean
    gameDate: string | null
    gameId: string | null
    title: string | null
  }>
}

async function fetchProfile(): Promise<TProfile> {
  const res = await fetch('/api/profile')
  if (!res.ok) throw new Error('profile-failed')
  return res.json()
}

export function useProfile() {
  return useQuery({ queryKey: [QUERY_KEYS.PROFILE], queryFn: fetchProfile, retry: 1 })
}

export function useProfileSuspense() {
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.PROFILE], queryFn: fetchProfile, retry: 1 })
}
