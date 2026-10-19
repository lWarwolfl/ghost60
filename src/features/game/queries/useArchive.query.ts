import { useInfiniteQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth/client'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TArchive = {
  locked: boolean
  days: Array<{ id: string; gameDate: string; gameId: string; title: string; completed: boolean; sourceRunId: string | null; bestScore: number | null }>
  nextCursor: string | null
  lockedOlder: number
}

async function fetchArchive(before?: string, game?: string): Promise<TArchive> {
  const params = new URLSearchParams()
  if (before) params.set('before', before)
  if (game) params.set('game', game)
  const res = await fetch(`/api/archive?${params}`, { cache: 'no-store' })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'archive-failed')
  return res.json()
}

export function useArchivePages(game?: string) {
  const { data: session } = authClient.useSession()
  return useInfiniteQuery({ queryKey: [QUERY_KEYS.ARCHIVE, 'pages', session?.user.id, game], enabled: Boolean(session?.user), placeholderData: undefined, refetchOnMount: 'always', initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => fetchArchive(pageParam, game), getNextPageParam: (page) => page.nextCursor ?? undefined, retry: 1 })
}

export function useArchive() {
  const { data: session } = authClient.useSession()
  return useQuery({ queryKey: [QUERY_KEYS.ARCHIVE, session?.user.id], enabled: Boolean(session?.user), placeholderData: undefined, refetchOnMount: 'always', queryFn: () => fetchArchive(), retry: 1 })
}

export function useArchiveSuspense() {
  const { data: session } = authClient.useSession()
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.ARCHIVE, session?.user.id], refetchOnMount: 'always', queryFn: () => fetchArchive(), retry: 1 })
}
