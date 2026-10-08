import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { LeaguesClient } from '@/app/leagues/page.client'

export default function LeaguesPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">Social</p>
          <h1 className="font-display text-3xl font-800">Friend leagues</h1>
        </div>
        <LeaguesClient />
      </main>
      <Footer />
    </div>
  )
}
