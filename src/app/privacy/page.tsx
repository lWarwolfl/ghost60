import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 text-ghost-text">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.18em] text-spectral-cyan">Legal</p>
        <h1 className="font-display text-3xl font-800">Privacy</h1>
        <div className="flex flex-col gap-3 text-sm leading-7 text-ghost-muted">
          <p>
            Ghost60 collects the minimum needed to run the daily game: your sign-in identity,
            handle and display name, game runs and their input event streams, streak/XP/achievement
            progress, league memberships, entitlement state, and coarse first-party product events.
          </p>
          <p>
            We do not collect precise location. We do not store raw IP addresses in product
            analytics. Public challenge pages expose only your handle, the game, the score, and a
            privacy-safe ghost timeline — never your email or device details.
          </p>
          <p>
            You can block other players, report abusive handles, leagues or challenges, disable
            your own challenge links, leave leagues, and delete your account at any time from
            Settings. Deletion removes your profile, runs, streak, XP, memberships and auth
            records, and disables your public challenge links.
          </p>
          <p>
            Ghost60 is 18+. There are no direct messages, no public feed, and no cash prizes.
          </p>
        </div>
        <Link href="/settings" className="text-sm text-spectral-cyan underline">
          Manage your data in Settings
        </Link>
      </main>
      <Footer />
    </div>
  )
}
