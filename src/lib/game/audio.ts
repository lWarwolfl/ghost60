import { getSoundPref } from '@/lib/hooks/useReducedMotion.hook'

let ctx: AudioContext | null = null

function ensureCtx() {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, ms: number, delayMs = 0, gain = 0.12) {
  if (getSoundPref() !== 'on') return
  const ac = ensureCtx()
  if (!ac) return
  const t0 = ac.currentTime + delayMs / 1000
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000)
  osc.connect(g)
  g.connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + ms / 1000 + 0.02)
}

function haptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof window !== 'undefined' && window.localStorage.getItem('ghost60-haptics') === 'on') navigator.vibrate?.(pattern)
  } catch {}
}

export const audio = {
  unlock() {
    ensureCtx()
  },
  tick() {
    tone(660, 60)
  },
  rule() {
    tone(740, 65)
  },
  go() {
    tone(990, 120)
  },
  correct() {
    haptic(10)
    tone(880, 70)
  },
  perfect() {
    haptic([8, 25, 12])
    tone(880, 70)
    tone(1320, 70, 60)
  },
  miss() {
    haptic(18)
    tone(180, 60, 0, 0.08)
  },
  finish() {
    haptic(20)
    tone(520, 250)
  },
  win() {
    tone(660, 120)
    tone(880, 120, 110)
    tone(990, 200, 220)
  }
}
