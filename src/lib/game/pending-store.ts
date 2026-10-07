import type { GameInputEvent } from '@/games/core/game-module'

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
