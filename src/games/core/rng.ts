import type { SeededRng } from '@/games/core/game-module'

export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function createRng(seed: string): SeededRng {
  let a = hashSeed(seed)
  return {
    nextUint32() {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return (t ^ (t >>> 14)) >>> 0
    },
    nextFloat() {
      return this.nextUint32() / 4294967296
    },
    nextInt(minInclusive: number, maxExclusive: number) {
      const span = maxExclusive - minInclusive
      if (span <= 0) return minInclusive
      return minInclusive + Math.floor(this.nextFloat() * span)
    }
  }
}
