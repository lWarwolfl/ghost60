'use client'

// First-party analytics sender. Batched, keepalive on hide, beacon on pagehide.
// No vendor SDK. Events dropped (never retried with backoff loops) when offline
// or when the queue overflows — analytics must never break gameplay.

import {
  ANALYTICS_MAX_PROPS,
  ANALYTICS_MAX_STR,
  type TAnalyticsEvent,
  type TAnalyticsProps
} from '@/lib/game/analytics'

type TQueued = { name: TAnalyticsEvent; properties: TAnalyticsProps; anonId: string; sessionKey: string }

const FLUSH_MS = 15_000
const MAX_QUEUE = 100

const queue: TQueued[] = []
let timer: ReturnType<typeof setInterval> | null = null
let listenersAttached = false

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function getAnonId(): string {
  try {
    const existing = window.localStorage.getItem('g60-anon')
    if (existing) return existing
    const fresh = uuid()
    window.localStorage.setItem('g60-anon', fresh)
    return fresh
  } catch {
    return 'ephemeral'
  }
}

function getSessionKey(): string {
  try {
    const existing = window.sessionStorage.getItem('g60-sess')
    if (existing) return existing
    const fresh = uuid()
    window.sessionStorage.setItem('g60-sess', fresh)
    return fresh
  } catch {
    return 'ephemeral'
  }
}

function sanitize(props?: Record<string, unknown>): TAnalyticsProps {
  const out: TAnalyticsProps = {}
  if (!props || typeof props !== 'object') return out
  for (const [k, v] of Object.entries(props)) {
    if (Object.keys(out).length >= ANALYTICS_MAX_PROPS) break
    if (k.length === 0 || k.length > 64) continue
    if (typeof v === 'string' && v.length <= ANALYTICS_MAX_STR) out[k] = v
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
  }
  return out
}

async function flush(useBeacon: boolean) {
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  const payload = JSON.stringify({
    events: batch.map((e) => ({
      name: e.name,
      properties: e.properties,
      anonId: e.anonId,
      sessionKey: e.sessionKey
    }))
  })
  try {
    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon(
        '/api/events',
        new Blob([payload], { type: 'application/json' })
      )
      if (!ok) throw new Error('beacon-rejected')
      return
    }
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    })
  } catch {
    // Analytics failures are silent by design. Re-queue only if small.
    if (queue.length + batch.length <= MAX_QUEUE) queue.unshift(...batch)
  }
}

function ensureLoop() {
  if (timer !== null || typeof window === 'undefined') return
  timer = setInterval(() => void flush(false), FLUSH_MS)
  if (!listenersAttached) {
    listenersAttached = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush(false)
    })
    window.addEventListener('pagehide', () => void flush(true))
  }
}

export function track(name: TAnalyticsEvent, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  ensureLoop()
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push({ name, properties: sanitize(props), anonId: getAnonId(), sessionKey: getSessionKey() })
}

export function flushAnalytics() {
  return flush(false)
}
