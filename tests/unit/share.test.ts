import { describe, expect, it } from 'vitest'
import { shareMessage } from '@/lib/game/share'

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
})
