'use client'

import { useLocalProgressStore } from '@/lib/game/local-progress'

export function useLocalProgress() {
  const runs = useLocalProgressStore((state) => state.runs)
  const xpTotal = useLocalProgressStore((state) => state.xpTotal)
  const best = useLocalProgressStore((state) => state.best)
  return { runs, xpTotal, best, pending: runs.filter((run) => !run.synced).length }
}
