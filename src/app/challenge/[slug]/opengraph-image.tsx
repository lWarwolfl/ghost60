import { ImageResponse } from 'next/og'
import { eq } from 'drizzle-orm'
import { db } from '@/drizzle'
import { Challenge, DailyGame, PlayerProfile, Run } from '@/drizzle/schema'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const dynamic = 'force-dynamic'

export default async function ChallengeOg({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rows = await db.select().from(Challenge).where(eq(Challenge.publicSlug, slug))
  const challenge = rows[0]
  const source = challenge
    ? (await db.select().from(Run).where(eq(Run.id, challenge.sourceRunId)))[0]
    : undefined
  const game = challenge
    ? (await db.select().from(DailyGame).where(eq(DailyGame.id, challenge.dailyGameId)))[0]
    : undefined
  const profile = challenge
    ? (await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, challenge.creatorUserId)))[0]
    : undefined
  const handle = profile?.handle ?? 'ghost'
  const score = source?.validatedScore ?? 0
  const title = game?.title ?? 'Ghost60'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#070912',
          color: '#f5f7ff',
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ fontSize: 36, color: '#a98bff', letterSpacing: 6 }}>GHOST CHALLENGE</div>
        <div style={{ fontSize: 84, fontWeight: 800, marginTop: 16 }}>{handle} left a ghost.</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, marginTop: 24 }}>
          <div style={{ fontSize: 120, fontWeight: 800, color: '#62f7e6' }}>{score}</div>
          <div style={{ fontSize: 36, color: '#9099ad' }}>
            {title} · one attempt · catch it
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
