import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function LeaguesPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <h1 className="font-display text-3xl font-800">Friend leagues</h1>
        <div className="rounded-card border border-dashed border-white/20 bg-ink-900 p-6 text-center">
          <p className="font-600">Empty league</p>
          <p className="mt-1 text-sm leading-6 text-ghost-muted">
            Create one league free, join up to 3, max 12 members. Weekly score is best 5 of 7
            normalized days — never raw cross-engine scores.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}
