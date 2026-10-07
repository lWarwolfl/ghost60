import { z } from 'zod'

export const SessionRequestSchema = z.object({
  mode: z.enum(['ranked', 'challenge', 'practice', 'past_self']),
  challengeId: z.string().uuid().optional()
})
export type TSessionRequest = z.output<typeof SessionRequestSchema>

export const ConsumeRequestSchema = z.object({ token: z.string().min(1) })

export const SubmitRequestSchema = z.object({
  token: z.string().min(1),
  events: z.array(z.unknown()),
  visibilityInterruptions: z.number().int().min(0).default(0)
})
