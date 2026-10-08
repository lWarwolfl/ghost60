import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'
import { LeagueDetailClient } from '@/app/leagues/[slug]/page.client'

export default async function LeagueDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <LeagueDetailClient slug={slug} />
      </main>
      <Footer />
    </div>
  )
}
