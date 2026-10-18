import { describe, expect, it } from 'vitest'
import { SessionRequestSchema } from '@/features/game/schemas/session.schema'

describe('archive session requests', () => {
  it('retains historical targets and requires an owned source for past self', () => {
    const id = '00000000-0000-4000-8000-000000000001'
    expect(SessionRequestSchema.parse({ mode: 'practice', dailyGameId: id })).toMatchObject({ dailyGameId: id })
    expect(SessionRequestSchema.safeParse({ mode: 'past_self' }).success).toBe(false)
    expect(SessionRequestSchema.parse({ mode: 'past_self', sourceRunId: id })).toMatchObject({ sourceRunId: id })
  })
})
