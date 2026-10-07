import { ProfileClient } from '@/app/profile/page.client'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function ProfilePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-8">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">Profile</p>
          <h1 className="font-display text-3xl font-800">Your haunting</h1>
        </div>
        <ProfileClient />
      </main>
      <Footer />
    </div>
  )
}
