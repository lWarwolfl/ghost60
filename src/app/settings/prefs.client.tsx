'use client'

import { useEffect, useState } from 'react'
import {
  PREFS_EVENT,
  getMotionPref,
  getSoundPref,
  setMotionPref,
  setSoundPref,
  type TMotionPref,
  type TSoundPref
} from '@/lib/hooks/useReducedMotion.hook'

export function PrefsClient() {
  const [motion, setMotion] = useState<TMotionPref>('system')
  const [sound, setSound] = useState<TSoundPref>('on')

  useEffect(() => {
    const sync = () => {
      setMotion(getMotionPref())
      setSound(getSoundPref())
    }
    sync()
    window.addEventListener(PREFS_EVENT, sync)
    return () => window.removeEventListener(PREFS_EVENT, sync)
  }, [])

  return (
    <section aria-labelledby="prefs" className="rounded-card border border-white/10 bg-surface-800 p-5">
      <h2 id="prefs" className="font-display text-lg font-800">
        Playback
      </h2>
      <div className="mt-3 flex flex-col gap-4">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>
            Motion
            <span className="block text-xs text-ghost-muted">Reduced removes nonessential animation, never difficulty.</span>
          </span>
          <select
            value={motion}
            onChange={(e) => setMotionPref(e.target.value as TMotionPref)}
            className="min-h-11 rounded-control border border-white/15 bg-ink-900 px-3 text-sm"
          >
            <option value="system">System</option>
            <option value="reduced">Reduced</option>
            <option value="full">Full</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
          <span>
            Sound
            <span className="block text-xs text-ghost-muted">Procedural cues only. Never required to play.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={sound === 'on'}
            onClick={() => setSoundPref(sound === 'on' ? 'off' : 'on')}
            className="flex min-h-11 min-w-16 items-center justify-center rounded-control border border-white/15 bg-ink-900 px-4 text-sm font-600"
          >
            {sound === 'on' ? 'On' : 'Off'}
          </button>
        </label>
      </div>
    </section>
  )
}
