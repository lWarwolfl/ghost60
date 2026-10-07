import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/drizzle'
import { Challenge, DailyGame, PlayerProfile, Run, type TChallenge } from '@/drizzle/schema'
import { GameIcon } from '@/components/brand/game-icon'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import type { GameId } from '@/games/core/game-module'

export const dynamic = 'force-dynamic'

async function loadChallenge(slug: string) {
  const rows = await db.select().from(Challenge).where(eq(Challenge.publicSlug, slug))
  const challenge = rows[0]
  if (!challenge) return null
  const games = await db.select().from(DailyGame).where(eq(DailyGame.id, challenge.dailyGameId))
  const sources = await db.select().from(Run).where(eq(Run.id, challenge.sourceRunId))
  const profiles = await db.select().from(PlayerProfile).where(eq(PlayerProfile.userId, challenge.creatorUserId))
  return { challenge, game: games[0] ?? null, source: sources[0] ?? null, handle: profiles[0]?.handle ?? 'ghost' }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await loadChallenge(slug)
  if (!data || !data.game || !data.source) return { title: 'Ghost60 challenge' }
  return {
    title: `${data.handle} left a ghost — Ghost60`,
    description: `Score ${data.source.validatedScore}. One attempt. Catch it.`,
    openGraph: { images: [`/challenge/${slug}/opengraph-image`] }
  }
}

export function isChallengeGone(challenge: Pick<TChallenge, 'disabledAt' | 'expiresAt'>) {
  return challenge.disabledAt !== null || challenge.expiresAt.getTime() < Date.now()
}

export default async function ChallengeLanding({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await loadChallenge(slug)
  if (!data) notFound()
  const { challenge, game, source, handle } = data
  const gone = isChallengeGone(challenge) || !game || !source

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        {gone ? (
          <div className="rounded-card border border-white/10 bg-surface-800 p-6 text-center">
            <p className="font-display text-2xl font-800">THIS GHOST IS GONE.</p>
            <p className="mt-2 text-sm leading-6 text-ghost-muted">
              The challenge expired or was disabled. Start your own daily run instead.
            </p>
            <Link
              href="/"
              className="mt-4 flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950"
            >
              PLAY TODAY&apos;S GHOST
            </Link>
          </div>
        ) : (
          <>
            <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-violet">Ghost challenge</p>
            <h1 className="font-display text-4xl font-800 leading-none">
              {handle} left a ghost.
            </h1>
            <div className="rounded-card border border-white/10 bg-surface-800 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-ghost-muted">
                    {game.title} · {game.gameDate}
                  </p>
                  <p className="tnum font-display text-5xl font-800">{source.validatedScore}</p>
                  <p className="text-sm text-ghost-muted">One attempt. Catch it.</p>
                </div>
                <GameIcon game={game.gameId as GameId} className="size-12 shrink-0" />
              </div>
            </div>
            <Link
              href={`/challenge/${slug}/race`}
              className="flex min-h-12 items-center justify-center rounded-control bg-spectral-cyan px-5 font-display text-sm font-800 tracking-[0.14em] text-ink-950"
            >
              RACE GHOST
            </Link>
            <p className="text-center text-xs text-ghost-muted">
              No signup needed. Your run races the frozen score.
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
