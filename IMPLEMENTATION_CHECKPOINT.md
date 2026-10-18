# Ghost60 implementation checkpoint

Latest owner request: implement all remaining code completely; owner handles visual checks. Owner additionally asks durable progress tracking because usage budget is low.

## Verified baseline

- Prior to this completion pass: 188 tests, lint, typecheck, production webpack build passed.
- Daily availability repaired against Neon; 5 daily shared charges, one ranked attempt, free challenges, unlimited Ghost+ practice implemented.
- Local development test-payment confirmation/reset implemented; production blocks test grants and ignores persisted test entitlements.

## Current pass — parent changes already written

- Fixed service worker cache boundaries: old worker cached authenticated API responses including charges/today/auth, plus personalized navigation HTML. New worker caches only static assets, uses generic offline page, deletes only Ghost60-owned caches and respects manual updates.
- Added public/offline.html.
- Updated settings worker update listener cleanup and scoped cache clearing to Ghost60.
- Added security response headers and private/no-store API policy in next.config.ts.
- Added metadataBase in root layout.
- Added validated /.well-known/assetlinks.json route and src/lib/android.ts. Requires real ANDROID_PACKAGE_NAME and ANDROID_SHA256_CERT_FINGERPRINTS; returns503 until configured. No invented certificate/domain.
- Fixed campaign uploader companion path and CRLF env loading; added nonwriting --check. All five real PNG sources checked successfully.
- Focused service-worker/android/media tests: 9 passed (service worker regression first failed then passed).
- Last scoped lint found prefer-const on timeout variable; fixed afterward, rerun pending.

## Parallel implementation — still running at checkpoint

Batch deleg_d8c83762. Do not overwrite files owned below while agents run. No browser checks, dependencies, commits, pushes or unapproved live database writes.

1. sa-0-6bc8628d — skins: src/lib/game/skins.ts, new client-safe skin rendering helpers/preview components, profile page/API/cosmetics, profile query types, result skin on play/run/page.client.tsx. Nine skin effects, server-entitled fallback, 2.5s previews, offscreen pause, max2mobile, result/card skins. Contract planned at Hermes scratch ghost60-skin-contract.txt.
2. sa-1-da09fcfb — vectors: src/components/brand existing components + wordmark/rank badge, globals.css, header/footer usage, new decorative motion hook. Unique IDs, all motion states, OS/in-app reduced and hidden-tab pause. Does not own parent root layout.
3. sa-2-1fe392ab — gameplay: six runners, useRunSession, sound/haptic helpers, gameplay motion tests. Integrates skin helper, correct feedback and privacy gates, trace>=500ms delay, dpr<=2. Asked to fix 3s running auto-consume and default sound mismatch if needed.
4. sa-3-c9493c89 — product/release: backend challenge/session/submit, archive/past-self/history, launch status readiness, analytics errors, preflight resume availability. No billing/skin/profile/vector/runner edits. Parent owns assetlinks/SW/metadata/config.

## Remaining integration/verification

- Receive all agent results; inspect actual diffs and wire contracts across skin helper/runners/avatar/profile/rank usage.
- Run full npm test, npm run lint, npx next typegen, npx tsc --noEmit, npm run build, npm run content:check, npm run db:check, npm run launch:status.
- Rerun latest tests after all writers finish; do not claim completion based on individual agent summaries.
- Update PROGRESS.md and companion STEP_BY_STEP.md to actual state, remove stale blanket completion claims for motion/skin gaps.
- Update installed ghost60 skill with actual reusable contracts and sync companion SKILL.md.
- Preserve pre-existing dirty package-lock.json and all prior changes; no commits/push unless requested.

## External/owner gates

Visual/device QA belongs to owner. Production domain/deploy, real Stripe checkout/webhook/portal delivery, owner-approved league identity, Android signing + Play Console release, and campaign upload are not verified. Never present local build success as production launch readiness. No live browser checks.
