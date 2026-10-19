import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type TLocalRun = {
  id: string
  gameId: string
  gameDate: string
  mode: string
  score: number
  valid: boolean
  personalBest: boolean
  xp: number
  at: number
  synced: boolean
}

export type TLocalProgress = {
  version: 1
  xpTotal: number
  best: Record<string, number>
  runs: TLocalRun[]
  updatedAt: number
}

type TLocalProgressState = TLocalProgress & {
  recordRun: (input: {
    id: string
    gameId: string
    gameDate: string
    mode: string
    score: number
    valid: boolean
  }) => { personalBest: boolean }
  markSynced: (id: string, patch: { score?: number; xp?: number; valid?: boolean; personalBest?: boolean }) => void
}

const MAX_RUNS = 20

export const useLocalProgressStore = create<TLocalProgressState>()(
  persist(
    (set, get) => ({
      version: 1,
      xpTotal: 0,
      best: {},
      runs: [],
      updatedAt: 0,
      recordRun(input) {
        const existing = get().runs.find((run) => run.id === input.id)
        if (existing?.synced) return { personalBest: existing.personalBest }
        const key = `${input.gameId}:${input.gameDate}`
        const previous = get().best[key]
        const personalBest = input.valid && (previous === undefined || input.score > previous)
        const run: TLocalRun = {
          ...input,
          personalBest,
          xp: 0,
          at: Date.now(),
          synced: false
        }
        set((state) => ({
          best: personalBest ? { ...state.best, [key]: input.score } : state.best,
          runs: [run, ...state.runs.filter((item) => item.id !== input.id)].slice(0, MAX_RUNS),
          updatedAt: Date.now()
        }))
        return { personalBest }
      },
      markSynced(id, patch) {
        set((state) => {
          const target = state.runs.find((run) => run.id === id)
          if (!target || target.synced) return state
          const bestKey = `${target.gameId}:${target.gameDate}`
          return {
            xpTotal: state.xpTotal + Math.max(0, patch.xp ?? 0),
            best:
              patch.personalBest && patch.score !== undefined
                ? { ...state.best, [bestKey]: Math.max(state.best[bestKey] ?? 0, patch.score) }
                : state.best,
            runs: state.runs.map((run) =>
              run.id === id
                ? {
                    ...run,
                    score: patch.score ?? run.score,
                    valid: patch.valid ?? run.valid,
                    personalBest: patch.personalBest ?? run.personalBest,
                    xp: patch.xp ?? 0,
                    synced: true
                  }
                : run
            ),
            updatedAt: Date.now()
          }
        })
      }
    }),
    {
      name: 'ghost60:progress',
      version: 1,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') throw new Error('local-progress:no-storage')
        return window.localStorage
      })
    }
  )
)

export function recordLocalRun(input: Parameters<TLocalProgressState['recordRun']>[0]) {
  return useLocalProgressStore.getState().recordRun(input)
}

export function markLocalRunSynced(id: string, patch: Parameters<TLocalProgressState['markSynced']>[1]) {
  useLocalProgressStore.getState().markSynced(id, patch)
}
