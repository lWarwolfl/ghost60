'use client'

import { useSyncExternalStore } from 'react'
import { PREFS_EVENT } from './useReducedMotion.hook'

export function getBrandMotionSnapshot() {
  let preference = 'system'
  try {
    preference = window.localStorage.getItem('ghost60-motion') ?? 'system'
  } catch {}
  const reduced =
    preference === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return `${reduced}:${document.hidden}`
}

export function subscribeBrandMotion(notify: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const update = () => {
    const [reduced, hidden] = getBrandMotionSnapshot().split(':')
    document.documentElement.dataset.reducedMotion = reduced
    document.documentElement.dataset.motionPaused = hidden
    notify()
  }
  media.addEventListener('change', update)
  window.addEventListener(PREFS_EVENT, update)
  window.addEventListener('storage', update)
  document.addEventListener('visibilitychange', update)
  update()
  return () => {
    media.removeEventListener('change', update)
    window.removeEventListener(PREFS_EVENT, update)
    window.removeEventListener('storage', update)
    document.removeEventListener('visibilitychange', update)
  }
}

export function useBrandMotion() {
  const snapshot = useSyncExternalStore(
    subscribeBrandMotion,
    getBrandMotionSnapshot,
    () => 'true:false'
  )
  const [reduced, hidden] = snapshot.split(':')
  return { 'data-reduced-motion': reduced, 'data-motion-paused': hidden }
}
