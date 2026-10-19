import { useInfiniteQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { authClient } from '@/lib/auth/client'

export type THistory = {
  locked: boolean
  runs: { id: string; gameDate: string; gameId: string; title: string; mode: string; score: number; valid: boolean; createdAt: string }[]
  skills: { gameId: string; gameDate: string; score: number }[]
  nextCursor: string | null
}

export function useHistory() {
  const { data: session } = authClient.useSession()
  return useInfiniteQuery({
    queryKey: [QUERY_KEYS.ARCHIVE, 'history', session?.user.id],
    enabled: Boolean(session?.user),
    placeholderData: undefined,
    refetchOnMount: 'always',
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<THistory> => {
      const response = await fetch(`/api/history${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('history-failed')
      return response.json()
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: 1
  })
}
