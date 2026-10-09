import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'

export type TArchive = {
  locked: boolean
  days: Array<{ gameDate: string; gameId: string; title: string; completed: boolean }>
  lockedOlder: number
}

async function fetchArchive(): Promise<TArchive> {
  const res = await fetch('/api/archive')
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'archive-failed')
  return res.json()
}

export function useArchive() {
  return useQuery({ queryKey: [QUERY_KEYS.ARCHIVE], queryFn: fetchArchive, retry: 1 })
}

export function useArchiveSuspense() {
  return useSuspenseQuery({ queryKey: [QUERY_KEYS.ARCHIVE], queryFn: fetchArchive, retry: 1 })
}
