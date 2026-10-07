import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

const LOCKS = [
  'Full daily archive',
  'Unlimited unranked practice',
  'Race your past self',
  'Per-game skill history',
  'Premium ghost trails and card skins'
]

export default function GhostPlusPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-violet">Ghost+</p>
        <h1 className="font-display text-3xl font-800">TRAIN AGAINST YOUR PAST.</h1>
        <p className="text-sm leading-6 text-ghost-muted">
          Locked in this phase. No billing wiring — every Ghost+ action is denied server-side
          until entitlements launch. Ranked fairness never changes.
        </p>
        <ul className="flex flex-col gap-2">
          {LOCKS.map((l) => (
            <li
              key={l}
              className="flex items-center justify-between rounded-card border border-white/10 bg-surface-800 px-4 py-3 text-sm"
            >
              {l}
              <span className="rounded-control border border-spectral-violet/50 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-spectral-violet">
                Locked
              </span>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  )
}
