import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/drizzle'
import { Challenge, DailyGame, PlayerProfile, Run, type TChallenge } from '@/drizzle/schema'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { RaceClient } from '@/app/challenge/[slug]/race/page.client'

export const dynamic = 'force-dynamic'

export function isChallengeGone(challenge: Pick<TChallenge, 'disabledAt' | 'expiresAt'>) {
  return challenge.disabledAt !== null || challenge.expiresAt.getTime() < Date.now()
}

export default async function RacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const rows = await db.select().from(Challenge).where(eq(Challenge.publicSlug, slug))
  const challenge = rows[0]
  if (!challenge || isChallengeGone(challenge)) notFound()
  const game = (await db.select().from(DailyGame).where(eq(DailyGame.id, challenge.dailyGameId)))[0]
  const source = (await db.select().from(Run).where(eq(Run.id, challenge.sourceRunId)))[0]
  const profile = (
    await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, challenge.creatorUserId))
  )[0]
  if (!game || !source) notFound()

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-violet">
            Racing {profile?.handle ?? 'ghost'} · target {source.validatedScore}
          </p>
          <h1 className="font-display text-3xl font-800">{game.title}</h1>
          <p className="text-sm leading-6 text-ghost-muted">{game.instruction}</p>
        </div>
        <RaceClient
          challengeId={challenge.id}
          slug={challenge.publicSlug}
          handle={profile?.handle ?? 'ghost'}
          targetScore={source.validatedScore}
        />
        <Link
          href={`/challenge/${slug}`}
          className="flex min-h-12 items-center justify-center rounded-control bg-surface-700 px-5 text-sm font-600"
        >
          Back to challenge
        </Link>
      </main>
      <Footer />
    </div>
  )
}
