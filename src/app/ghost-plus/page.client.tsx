'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/features/game/queries/keys'
import { Footer } from '@/components/layout/footer'
import { TrackView } from '@/components/analytics/track-view'
import { Header } from '@/components/layout/header'
import { useCharges } from '@/features/game/queries/useCharges.query'
import { authClient } from '@/lib/auth/client'
import { getErrorMessage } from '@/lib/utils'

export function GhostPlusClient({
  billingAvailable,
  awaitingPayment,
  testPayments,
}: {
  billingAvailable: boolean
  awaitingPayment: boolean
  testPayments: boolean
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const queryClient = useQueryClient()
  const charges = useCharges()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const linked = Boolean(session?.user && !session.user.isAnonymous)
  const plan = charges.data?.plan
  const active = plan === 'ghost_plus'
  const userId = session?.user.id
  const { refetch } = charges

  useEffect(() => {
    if (!awaitingPayment || !userId) return
    void refetch()
    if (active) return
    const timer = setInterval(() => void refetch(), 5000)
    return () => clearInterval(timer)
  }, [awaitingPayment, userId, active, refetch])

  useEffect(() => {
    if (plan) void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PROFILE] })
  }, [plan, queryClient])

  const testPayment = async (reset: boolean) => {
    setError(null)
    setPending(true)
    try {
      const res = await fetch('/api/billing/test-confirmation', {
        method: reset ? 'DELETE' : 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'test-confirmation-failed')
      await charges.refetch()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  const openBilling = async (action: 'checkout' | 'portal') => {
    setError(null)
    setPending(true)
    try {
      if (!billingAvailable) throw new Error('billing-unavailable')
      if (!linked) {
        const result = await authClient.signIn.social({
          provider: 'google',
          callbackURL: '/ghost-plus',
        })
        if (result.error) throw new Error(result.error.message ?? 'sign-in-required')
        return
      }
      const res = await fetch(`/api/billing/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'billing-failed')
      if (typeof data.url !== 'string') throw new Error('billing-failed')
      window.location.assign(data.url)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-ink-950 text-ghost-text flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
        <TrackView name="paywall_viewed" props={{ surface: 'ghost-plus' }} />
        <p className="text-spectral-violet text-[11px] tracking-[0.18em] uppercase">Ghost+</p>
        <h1 className="font-display font-800 text-3xl">KEEP YOUR GHOST MOVING.</h1>
        <p className="text-ghost-muted text-sm leading-6">
          Unlimited unranked practice. Free players get five combined ranked and practice charges
          per UTC day. Everyone still gets exactly one ranked attempt. Challenge races stay free.
        </p>
        <div
          className="rounded-card border-spectral-violet/30 bg-surface-800 border p-5 text-sm"
          aria-live="polite"
        >
          {active ? (
            <p>Ghost+ is active. Your practice is unlimited.</p>
          ) : awaitingPayment ? (
            <p>
              Awaiting verified payment. Your plan only changes after the server confirms payment.
            </p>
          ) : (
            <p>
              Upgrade for unlimited practice. Review pricing and subscription terms securely at
              checkout.
            </p>
          )}
          {charges.isError && (
            <p role="alert" className="text-rival-coral mt-2">
              {charges.error.message}
            </p>
          )}
          {(awaitingPayment || charges.isError) && (
            <button
              type="button"
              onClick={() => void charges.refetch()}
              disabled={!session?.user || charges.isFetching}
              className="mt-2 min-h-11 underline disabled:opacity-50"
            >
              Refresh payment status
            </button>
          )}
        </div>
        {testPayments && (
          <section className="rounded-card border-signal-lime/40 bg-surface-800 border p-5">
            <h2 className="font-display font-800 text-lg">Test payment</h2>
            <p className="text-ghost-muted mt-2 text-sm">
              Local development only. No money is charged. Confirm to unlock Ghost+ for 24 hours,
              including guest accounts.
            </p>
            <button
              type="button"
              onClick={() => void testPayment(false)}
              disabled={!session?.user || pending || active}
              className="rounded-control bg-signal-lime font-600 text-ink-950 mt-3 flex min-h-12 w-full items-center justify-center px-4 disabled:opacity-50"
            >
              CONFIRM TEST PAYMENT
            </button>
            <button
              type="button"
              onClick={() => void testPayment(true)}
              disabled={!session?.user || pending}
              className="mt-2 min-h-11 text-sm underline disabled:opacity-50"
            >
              Reset test payment
            </button>
          </section>
        )}
        {!billingAvailable && (
          <p role="status" className="text-ghost-muted text-sm">
            Billing is currently unavailable. You can still play with your daily charges.
          </p>
        )}
        {error && (
          <p role="alert" className="text-rival-coral text-sm">
            {error === 'billing-unavailable'
              ? 'Billing is currently unavailable. Please try again later.'
              : error === 'sign-in-required'
                ? 'Sign in with Google to upgrade or manage your subscription.'
                : error}
          </p>
        )}
        {!active && (
          <button
            type="button"
            onClick={() => void openBilling('checkout')}
            disabled={
              !billingAvailable ||
              sessionPending ||
              pending ||
              (linked && (charges.isPending || charges.isError)) ||
              awaitingPayment
            }
            className="rounded-control bg-spectral-violet font-display font-800 text-ink-950 flex min-h-12 items-center justify-center px-5 text-sm tracking-[0.14em] disabled:opacity-50"
          >
            {pending ? 'OPENING…' : !linked ? 'SIGN IN WITH GOOGLE TO UPGRADE' : 'GET GHOST+'}
          </button>
        )}
        {linked && billingAvailable && (
          <button
            type="button"
            onClick={() => void openBilling('portal')}
            disabled={pending}
            className="rounded-control border-spectral-violet/50 font-600 text-spectral-violet flex min-h-12 items-center justify-center border px-5 text-sm disabled:opacity-50"
          >
            Manage subscription
          </button>
        )}
        <Link
          href="/play"
          className="rounded-control font-600 flex min-h-12 items-center justify-center border border-white/15 px-5 text-sm"
        >
          Back to play
        </Link>
      </main>
      <Footer />
    </div>
  )
}
