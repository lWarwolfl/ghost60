import { z } from 'zod'

export const ENGINES = ['pulse', 'snap', 'orbit', 'recall', 'shift', 'trace'] as const

export const SessionRequestSchema = z.object({
  mode: z.enum(['ranked', 'challenge', 'practice', 'past_self', 'special', 'dev']),
  challengeId: z.string().uuid().optional(),
  dailyGameId: z.string().uuid().optional(),
  sourceRunId: z.string().uuid().optional(),
  engine: z.enum(ENGINES).optional()
}).refine((value) => value.mode !== 'past_self' || Boolean(value.sourceRunId))
  .refine((value) => !value.challengeId || value.mode === 'challenge')
  .refine((value) => !value.dailyGameId || value.mode === 'practice' || value.mode === 'special')
  .refine((value) => value.mode !== 'practice' || Boolean(value.dailyGameId))
  .refine((value) => !value.sourceRunId || value.mode === 'past_self')
  .refine((value) => !value.engine || value.mode === 'dev')
export type TSessionRequest = z.output<typeof SessionRequestSchema>

export const ConsumeRequestSchema = z.object({ token: z.string().min(1) })

export const SubmitRequestSchema = z.object({
  token: z.string().min(1),
  events: z.array(z.unknown()),
  visibilityInterruptions: z.number().int().min(0).default(0)
})
