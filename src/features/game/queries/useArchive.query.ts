import { useInfiniteQuery, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TArchive = {
  locked: boolean
  days: Array<{ id: string; gameDate: string; gameId: string; title: string; completed: boolean; sourceRunId: string | null; bestScore: number | null }>
  nextCursor: string | null
  lockedOlder: number
}

async function fetchArchive(before?: string): Promise<TArchive> {
  const res = await fetch(`/api/archive${before ? `?before=${encodeURIComponent(before)}` : ''}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'archive-failed')
  return res.json()
}

export function useArchivePages() {
  return useInfiniteQuery({ queryKey: [QUERY_KEYS.ARCHIVE, 'pages'], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam }) => fetchArchive(pageParam), getNextPageParam: (page) => page.nextCursor ?? undefined, retry: 1 })
}

export function useArchive() {
  return useQuery({ queryKey: [QUERY_KEYS.ARCHIVE], queryFn: () => fetchArchive(), retry: 1 })
}

export function useArchiveSuspense() {
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.ARCHIVE], queryFn: () => fetchArchive(), retry: 1 })
}
