import Link from 'next/link'
import { GameIcon } from '@/components/brand/game-icon'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function PlayPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">
          Preflight · PULSE · 45s
        </p>
        <h1 className="font-display text-3xl font-800">Tap when the ring sits in the band</h1>
        <div className="rounded-card border border-white/10 bg-surface-800 p-5">
          <GameIcon game="pulse" className="size-12" />
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-ghost-muted">
            <li>One ranked attempt. Consumed on first input or 3s after start.</li>
            <li>Closing or reloading after consumption still spends the attempt.</li>
            <li>Score is decided by server replay, not your screen.</li>
            <li>Sound off by default. Reduced-motion respected. 44px targets.</li>
          </ul>
        </div>
        <div className="rounded-card border border-signal-amber/40 bg-ink-900 p-4 text-sm leading-6 text-ghost-muted">
          Ranked engine ships in Milestone 4. This preflight shell holds the layout, copy and
          fairness rules so UI review can happen before gameplay lands.
        </div>
        <Link
          href="/"
          className="flex min-h-12 items-center justify-center rounded-control bg-surface-700 px-5 text-sm font-600"
        >
          Back to today
        </Link>
      </main>
      <Footer />
    </div>
  )
}
