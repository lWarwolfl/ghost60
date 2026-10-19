import { beforeEach, describe, expect, it, vi } from 'vitest'

let storage: Map<string, string>
let mod: typeof import('@/lib/game/local-progress')

beforeEach(async () => {
  storage = new Map()
  vi.resetModules()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  })
  mod = await import('@/lib/game/local-progress')
  mod.useLocalProgressStore.setState({ version: 1, xpTotal: 0, best: {}, runs: [], updatedAt: 0 })
})

describe('persisted local progress', () => {
  it('records runs locally, keeps the best, and merges the server confirmation once', () => {
    const first = mod.useLocalProgressStore.getState().recordRun({
      id: 't1',
      gameId: 'snap',
      gameDate: '2026-10-19',
      mode: 'run',
      score: 700,
      valid: true
    })
    expect(first.personalBest).toBe(true)
    const lower = mod.useLocalProgressStore.getState().recordRun({
      id: 't2',
      gameId: 'snap',
      gameDate: '2026-10-19',
      mode: 'run',
      score: 500,
      valid: true
    })
    expect(lower.personalBest).toBe(false)
    mod.useLocalProgressStore.getState().markSynced('t1', { score: 800, xp: 25, valid: true, personalBest: true })
    mod.useLocalProgressStore.getState().markSynced('t1', { score: 800, xp: 25, valid: true, personalBest: true })
    const state = mod.useLocalProgressStore.getState()
    expect(state.xpTotal).toBe(25)
    expect(state.best['snap:2026-10-19']).toBe(800)
    expect(state.runs.find((run) => run.id === 't1')?.synced).toBe(true)
    expect(state.runs.filter((run) => !run.synced)).toHaveLength(1)
    expect(storage.get('ghost60:progress')).toContain('"xpTotal":25')
  })

  it('rehydrates saved progress from local storage', async () => {
    storage.set(
      'ghost60:progress',
      JSON.stringify({
        state: {
          version: 1,
          xpTotal: 40,
          best: { 'snap:2026-10-18': 900 },
          runs: [
            {
              id: 'old',
              gameId: 'snap',
              gameDate: '2026-10-18',
              mode: 'run',
              score: 900,
              valid: true,
              personalBest: true,
              xp: 10,
              at: 1,
              synced: true
            }
          ],
          updatedAt: 1
        },
        version: 1
      })
    )
    vi.resetModules()
    const fresh = await import('@/lib/game/local-progress')
    expect(fresh.useLocalProgressStore.getState().runs[0]?.id).toBe('old')
    expect(fresh.useLocalProgressStore.getState().xpTotal).toBe(40)
  })
})
