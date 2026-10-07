import { getSoundPref } from '@/lib/hooks/useReducedMotion.hook'

let ctx: AudioContext | null = null

function ensureCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
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

export const audio = {
  unlock() {
    ensureCtx()
  },
  tick() {
    tone(660, 60)
  },
  go() {
    tone(990, 120)
  },
  correct() {
    tone(880, 70)
  },
  perfect() {
    tone(880, 70)
    tone(1320, 100, 60)
  },
  miss() {
    tone(180, 60, 0, 0.08)
  },
  finish() {
    tone(520, 250)
  },
  win() {
    tone(660, 120)
    tone(880, 120, 110)
    tone(990, 200, 220)
  }
}
