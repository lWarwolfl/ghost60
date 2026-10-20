import { describe, expect, it } from 'vitest'
import { shareFileName, shareMessage } from '@/lib/game/share'

describe('shareMessage', () => {
  it('invites a race for a solo run', () => {
    expect(shareMessage({ score: 1200, gameTitle: 'Clean Orbit' })).toBe(
      'I scored 1200 on Clean Orbit. Can you catch my ghost?'
    )
  })
  it('names the rival and normalizes the handle', () => {
    expect(
      shareMessage({ score: 900, gameTitle: 'First Signal', challengeHandle: '@nova' })
    ).toBe("I raced @nova's ghost on First Signal and scored 900. Think you can catch me?")
    expect(shareMessage({ score: 900, gameTitle: 'First Signal', challengeHandle: 'nova' })).toBe(
      "I raced @nova's ghost on First Signal and scored 900. Think you can catch me?"
    )
  })
  it('makes a safe image filename', () => {
    expect(shareFileName('Clean Orbit', 1200)).toBe('ghost60-clean-orbit-1200.png')
    expect(shareFileName('  ??? ', 0)).toBe('ghost60-run-0.png')
  })
})
