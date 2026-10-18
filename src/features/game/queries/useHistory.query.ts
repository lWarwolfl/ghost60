import { useInfiniteQuery } from '@tanstack/react-query'

export type THistory = {
  locked: boolean
  runs: { id: string; gameDate: string; gameId: string; title: string; mode: string; score: number; valid: boolean; createdAt: string }[]
  skills: { gameId: string; gameDate: string; score: number }[]
  nextCursor: string | null
}

export function useHistory() {
  return useInfiniteQuery({
    queryKey: ['history'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<THistory> => {
      const response = await fetch(`/api/history${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`)
      if (!response.ok) throw new Error('history-failed')
      return response.json()
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry: 1
  })
}
