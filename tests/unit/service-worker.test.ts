import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const handlers: Record<string, (event: Record<string, unknown>) => void> = {}
  const fetch = vi.fn(async () => new Response('fresh'))
  const put = vi.fn()
  const caches = {
    match: vi.fn(async () => undefined),
    open: vi.fn(async () => ({ put, addAll: vi.fn() })),
    keys: vi.fn(async () => ['ghost60-v1', 'other-app']),
    delete: vi.fn(),
  }
  vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://ghost.test' },
      addEventListener: (name: string, fn: (event: Record<string, unknown>) => void) => {
        handlers[name] = fn
      },
      clients: { claim: vi.fn() },
      skipWaiting: vi.fn(),
    },
    caches,
    fetch,
    URL,
    Response,
  })
  const send = (path: string, mode = 'cors') => {
    const respondWith = vi.fn()
    handlers.fetch({
      request: { method: 'GET', url: `https://ghost.test${path}`, mode },
      respondWith,
      waitUntil: vi.fn(),
    })
    return respondWith
  }
  return { handlers, send, fetch, caches, put }
}

describe('service worker cache boundaries', () => {
  it('never intercepts authenticated APIs or RSC requests', () => {
    const w = worker()
    for (const path of [
      '/api/game/today',
      '/api/game/charges',
      '/api/auth/get-session',
      '/play?_rsc=123',
    ]) {
      expect(w.send(path)).not.toHaveBeenCalled()
    }
  })
  it('never persists authenticated navigation HTML', async () => {
    const w = worker()
    const response = w.send('/profile', 'navigate')
    expect(await response.mock.calls[0][0]).toBeInstanceOf(Response)
    expect(w.caches.open).not.toHaveBeenCalled()
    expect(w.put).not.toHaveBeenCalled()
  })
  it('caches only static assets and deletes only owned caches', async () => {
    const w = worker()
    const response = w.send('/_next/static/chunks/abc.js')
    await response.mock.calls[0][0]
    expect(w.caches.open).toHaveBeenCalled()
    let activation: Promise<unknown> | undefined
    w.handlers.activate({
      waitUntil: (promise: Promise<unknown>) => {
        activation = promise
      },
    })
    await activation
    expect(w.caches.delete).toHaveBeenCalledWith('ghost60-v1')
    expect(w.caches.delete).not.toHaveBeenCalledWith('other-app')
  })
})
