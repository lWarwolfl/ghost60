import { GhostPlusClient } from '@/app/ghost-plus/page.client'

export default async function GhostPlusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const billingAvailable = Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_GHOST_PLUS_PRICE_ID &&
    process.env.STRIPE_WEBHOOK_SECRET
  )
  return (
    <GhostPlusClient
      testPayments={process.env.NODE_ENV === 'development'}
      billingAvailable={billingAvailable}
      awaitingPayment={params.checkout === 'success'}
    />
  )
}
