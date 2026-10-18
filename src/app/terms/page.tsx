import Link from 'next/link'
import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

export default function TermsPage() {
  return (
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8 sm:max-w-2xl">
        <p className="text-spectral-cyan text-[11px] tracking-[0.18em] uppercase">Legal</p>
        <h1 className="font-display font-800 text-3xl">Terms</h1>
        <div className="text-ghost-muted flex flex-col gap-3 text-sm leading-7">
          <p>
            One shared game per day. One ranked run. Your client score is a preview only — the
            server replay decides the validated score, and its decision is final.
          </p>
          <p>
            Your attempt is spent on first meaningful input or shortly after the run starts. Closing
            or reloading after that does not restore it. Exploiting bugs, bots, modified clients or
            replayed event streams can get runs rejected and accounts removed.
          </p>
          <p>
            Free play includes five charges per UTC day for ranked and practice runs. Challenge
            races are free. Ghost+ includes unlimited practice, not extra ranked attempts. Checkout
            shows the subscription price and renewal terms before payment. You can manage or cancel
            the subscription from Ghost+.
          </p>
          <p>
            Paid features never change ranked fairness: no extra ranked attempts, no score
            multipliers, no easier difficulty. Cosmetics are visual only.
          </p>
          <p>
            Be decent: no abusive handles or league names. Reports are reviewed; abuse can lead to
            removed content or accounts. You must be 18 or older to play.
          </p>
        </div>
        <Link href="/" className="text-spectral-cyan text-sm underline">
          Back to today&apos;s game
        </Link>
      </main>
      <Footer />
    </div>
  )
}
