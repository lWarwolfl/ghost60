'use client'

import { useCallback, useEffect, useState } from 'react'

type Status = {
  supported: boolean
  controlled: boolean
  caches: string[]
  quota?: number
  usage?: number
}

async function readStatus(): Promise<Status> {
  if (!('serviceWorker' in navigator)) return { supported: false, controlled: false, caches: [] }
  const keys = 'caches' in window ? await caches.keys() : []
  let quota: number | undefined
  let usage: number | undefined
  try {
    const est = await navigator.storage.estimate()
    quota = est.quota
    usage = est.usage
  } catch {
    quota = undefined
  }
  return { supported: true, controlled: navigator.serviceWorker.controller !== null, caches: keys, quota, usage }
}

function formatBytes(n?: number) {
  if (n === undefined) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

export function SettingsClient() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<'check' | 'apply' | 'clear' | null>(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    readStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const checkForUpdates = useCallback(async () => {
    setBusy('check')
    setNote(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setNote('No worker registered yet. Reload once, then check again.')
        return
      }
      await reg.update()
      if (reg.waiting) {
        setUpdateReady(true)
        setNote('A newer version is ready to apply.')
      } else {
        setNote('Already on the newest version.')
      }
    } finally {
      setStatus(await readStatus())
      setBusy(null)
    }
  }, [])

  const applyUpdate = useCallback(async () => {
    setBusy('apply')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
      await new Promise<void>((resolve) => {
        const onControl = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onControl)
          resolve()
        }
        navigator.serviceWorker.addEventListener('controllerchange', onControl)
        setTimeout(resolve, 4000)
      })
      window.location.reload()
    } finally {
      setBusy(null)
    }
  }, [])

  const clearCache = useCallback(async () => {
    setBusy('clear')
    setNote(null)
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.unregister()
      window.location.reload()
    } catch {
      setNote('Could not clear everything. Try again.')
      setBusy(null)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="sw-status" className="rounded-card border border-white/10 bg-surface-800 p-5">
        <h2 id="sw-status" className="font-display text-lg font-800">
          Offline version
        </h2>
        {status === null ? (
          <p className="mt-1 text-sm text-ghost-muted">Reading worker state…</p>
        ) : !status.supported ? (
          <p className="mt-1 text-sm text-ghost-muted">This browser has no service-worker support.</p>
        ) : (
          <dl className="mt-2 flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-ghost-muted">Worker</dt>
              <dd>{status.controlled ? 'Active' : 'Not controlling this tab yet'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ghost-muted">Cached shells</dt>
              <dd className="tnum">{status.caches.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ghost-muted">Storage used</dt>
              <dd className="tnum">
                {formatBytes(status.usage)} / {formatBytes(status.quota)}
              </dd>
            </div>
          </dl>
        )}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={checkForUpdates}
            disabled={busy !== null}
            className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950 disabled:opacity-50"
          >
            {busy === 'check' ? 'CHECKING…' : 'CHECK FOR UPDATES'}
          </button>
          {updateReady && (
            <button
              type="button"
              onClick={applyUpdate}
              disabled={busy !== null}
              className="flex min-h-12 items-center justify-center rounded-control border border-signal-lime/60 px-5 text-sm font-600 text-signal-lime disabled:opacity-50"
            >
              {busy === 'apply' ? 'APPLYING…' : 'APPLY NEW VERSION NOW'}
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="cache-clear" className="rounded-card border border-white/10 bg-ink-900 p-5">
        <h2 id="cache-clear" className="font-display text-lg font-800">
          Start fresh
        </h2>
        <p className="mt-1 text-sm leading-6 text-ghost-muted">
          Removes every cached file and the worker, then reloads. Your account, runs and streak
          stay on the server — only offline copies are dropped.
        </p>
        <button
          type="button"
          onClick={clearCache}
          disabled={busy !== null}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-control border border-rival-coral/60 px-5 text-sm font-600 text-rival-coral disabled:opacity-50"
        >
          {busy === 'clear' ? 'CLEARING…' : 'CLEAR OFFLINE CACHE'}
        </button>
      </section>

      {note && (
        <p role="status" className="rounded-card border border-white/10 bg-surface-800 px-4 py-3 text-sm">
          {note}
        </p>
      )}
    </div>
  )
}
