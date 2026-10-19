import type { GameInputEvent } from '@/games/core/game-module'
import { markLocalRunSynced } from '@/lib/game/local-progress'

export type TPendingSubmission = {
  token: string
  gameId: string
  events: GameInputEvent[]
  visibilityInterruptions: number
  savedAt: number
}

const DB = 'ghost60'
const STORE = 'pending'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'token' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = run(t.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function savePending(sub: TPendingSubmission) {
  return tx('readwrite', (s) => s.put(sub))
}

export function loadPending(token: string) {
  return tx('readonly', (s) => s.get(token)) as Promise<TPendingSubmission | undefined>
}

export function clearPending(token: string) {
  return tx('readwrite', (s) => s.delete(token))
}

export function listPending() {
  return tx('readonly', (s) => s.getAll()) as Promise<TPendingSubmission[]>
}

export async function flushPending(request: typeof fetch = fetch) {
  if (typeof indexedDB === 'undefined') return 0
  const items = await listPending().catch(() => [])
  let synced = 0
  for (const item of items) {
    try {
      const res = await request('/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: item.token,
          events: item.events,
          visibilityInterruptions: item.visibilityInterruptions
        })
      })
      if (res.ok) {
        synced += 1
        const data = (await res.json().catch(() => null)) as {
          run?: { validatedScore?: number; valid?: boolean }
          progression?: { xpAwarded?: number; isPersonalBest?: boolean }
        } | null
        if (data?.run && typeof data.run.validatedScore === 'number') {
          markLocalRunSynced(item.token, {
            score: data.run.validatedScore,
            valid: data.run.valid ?? true,
            xp: data.progression?.xpAwarded ?? 0,
            personalBest: data.progression?.isPersonalBest ?? false
          })
        }
        await clearPending(item.token).catch(() => undefined)
      }
    } catch {}
  }
  return synced
}
