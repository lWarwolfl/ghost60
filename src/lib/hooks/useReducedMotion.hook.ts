'use client'

import { useEffect, useState } from 'react'

export type TMotionPref = 'system' | 'reduced' | 'full'
export type TSoundPref = 'on' | 'off'

const MOTION_KEY = 'ghost60-motion'
const SOUND_KEY = 'ghost60-sound'
export const PREFS_EVENT = 'ghost60:prefs'

export function getMotionPref(): TMotionPref {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(MOTION_KEY)
  return v === 'reduced' || v === 'full' ? v : 'system'
}

export function getSoundPref(): TSoundPref {
  if (typeof window === 'undefined') return 'on'
  return window.localStorage.getItem(SOUND_KEY) === 'off' ? 'off' : 'on'
}

export function setMotionPref(v: TMotionPref) {
  window.localStorage.setItem(MOTION_KEY, v)
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export function setSoundPref(v: TSoundPref) {
  window.localStorage.setItem(SOUND_KEY, v)
  window.dispatchEvent(new Event(PREFS_EVENT))
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const compute = () => {
      const pref = getMotionPref()
      setReduced(pref === 'reduced' || (pref === 'system' && mq.matches))
    }
    compute()
    mq.addEventListener('change', compute)
    window.addEventListener(PREFS_EVENT, compute)
    return () => {
      mq.removeEventListener('change', compute)
      window.removeEventListener(PREFS_EVENT, compute)
    }
  }, [])
  return reduced
}
