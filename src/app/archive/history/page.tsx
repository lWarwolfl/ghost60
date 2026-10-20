import { Footer } from '@/components/layout/footer'
import { HistoryClient } from './page.client'

export default function HistoryPage() {
  return <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text"><main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8"><h1 className="font-display text-3xl font-800">Performance history</h1><HistoryClient /></main><Footer /></div>
}
