import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function PrivacyPage() {
  return (
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <p className="text-spectral-cyan text-[11px] tracking-[0.18em] uppercase">Legal</p>
        <h1 className="font-display font-800 text-3xl">Privacy</h1>
        <div className="text-ghost-muted flex flex-col gap-3 text-sm leading-7">
          <p>
            Ghost60 collects the minimum needed to run the daily game: your sign-in identity, handle
            and display name, game runs and their input event streams, streak/XP/achievement
            progress, league memberships, entitlement state, and coarse first-party product events.
          </p>
          <p>
            We do not collect precise location. We do not store raw IP addresses in product
            analytics. Public challenge pages expose only your handle, the game, the score, and a
            privacy-safe ghost timeline — never your email or device details.
          </p>
          <p>
            You can block other players, report abusive handles, leagues or challenges, disable your
            own challenge links, leave leagues, and delete your account at any time from Settings.
            Deletion removes your profile, runs, streak, XP, memberships and auth records, and
            disables your public challenge links.
          </p>
          <p>Ghost60 is 18+. There are no direct messages, no public feed, and no cash prizes.</p>
          <p>
            Optional Ghost+ payments are handled by Stripe. We store the customer and subscription
            identifiers and entitlement status needed to provide access, not your card details.
            Delete account also cancels your linked subscription before erasing your billing
            records. If cancellation fails, your account is kept so you can retry.
          </p>
        </div>
        <Link href="/settings" className="text-spectral-cyan text-sm underline">
          Manage your data in Settings
        </Link>
      </main>
      <Footer />
    </div>
  )
}
