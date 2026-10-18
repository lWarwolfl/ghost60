# Ghost60 billing and charges

The owner's charge/payment request supersedes the older Stripe-paused milestone.

## Play allowance

- Free: five shared ranked/practice charges per UTC day. Challenge races remain free.
- Ranked: exactly one daily attempt, regardless of plan. Paying never buys ranked retries.
- Ghost+: unlimited unranked practice plus existing premium features.
- Session creation reserves a charge server-side. Consumed or submitted sessions spend it; duplicate requests must not overspend the daily allowance.
- The balance comes from authenticated `GET /api/game/charges`, never local storage.

## Local test confirmation

Run the dev server (`npm run dev -- -p 3104`) and open `http://localhost:3104/ghost-plus`. Click `CONFIRM TEST PAYMENT` to enable real server-side Ghost+ feature access for 24 hours without Stripe or a Google sign-in. Click `Reset test payment` to return to free access. No charge is made.

The confirmation API requires a local, same-origin, authenticated request and `NODE_ENV=development`. It never overwrites a real subscription; reset deletes only the caller's `provider=test` row. Production rejects confirmation and ignores stored test entitlements, even when development shares the database.

## Provider configuration

Set these in the app's private deployment environment, never public variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_GHOST_PLUS_PRICE_ID`: a recurring Stripe price for Ghost+; Stripe Checkout displays the configured price and currency.
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`: the trusted app origin, with HTTPS in production.

Checkout: authenticated `POST /api/billing/checkout`. Link an anonymous player to Google before buying so a cleared browser does not lose the purchase.

Manage/cancel: authenticated `POST /api/billing/portal`. Enable subscription management in the Stripe customer portal.

Webhook: `POST /api/billing/webhook`. Configure Stripe subscription and checkout lifecycle delivery. Entitlements must be granted from verified provider state, not the success redirect.

Missing provider configuration keeps checkout unavailable without affecting free play. No Stripe keys were available during implementation, so live checkout, webhook delivery, cancellation and refunds remain deployment acceptance checks. Never use a real card or take payment as a test without the owner's approval.

## Acceptance

Run unit tests for charges, entitlement expiry and webhook verification, then `npm run build` and lint. With Stripe test-mode configuration, verify checkout, signed delivery, duplicate delivery, canceled/expired subscriptions, portal cancellation and account deletion. Read back entitlements after each provider event. Recheck one-ranked-per-day under both plans.
