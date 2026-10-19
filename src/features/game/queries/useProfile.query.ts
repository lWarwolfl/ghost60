import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { authClient } from '@/lib/auth/client'
import type { TSkin, TSkinEntitlement } from '@/lib/game/skins'

export type TProfile = {
  plan: TSkinEntitlement
  profile: { handle: string | null; displayName: string | null } | null
  streak: { currentCount: number; longestCount: number; graceTokens: number } | null
  xpTotal: number
  level: { level: number; intoLevel: number; need: number }
  history: { locked: boolean; days: number }
  cosmetics: {
    equipped: { ghost: string | null; card: string | null }
    catalog: Array<TSkin & { unlocked: boolean; gradient: [string, string] }>
  }
  achievements: Array<{
    achievementId: string
    detail: { title: string; description: string } | null
  }>
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

const profileOptions = (userId?: string) => ({
  queryKey: [QUERY_KEYS.PROFILE, userId],
  queryFn: fetchProfile,
  retry: 1,
  staleTime: 0,
  refetchOnMount: 'always' as const,
  refetchOnWindowFocus: 'always' as const,
  refetchOnReconnect: 'always' as const,
  refetchInterval: 60000,
})

export function useProfile() {
  const { data: session } = authClient.useSession()
  return useQuery({ ...profileOptions(session?.user.id), enabled: Boolean(session?.user) })
}

export function useProfileSuspense() {
  const { data: session } = authClient.useSession()
  return useSuspenseQuery(profileOptions(session?.user.id))
}
