# Ghost60 implementation checkpoint

## Integrated completion — 2026-10-19

All continuation agents finished. Owner baseline: aec9b22. Changes remain uncommitted; no pushes. This section supersedes historical pending items below.

Completed: nine skin recipes/previews/equip and result cosmetics; all six entitled gameplay avatars; TRACE bounded delayed rival trails; vector/icon/rank motion with sixteen byte-identical source SVGs; account-scoped profile/payment freshness; result reveal; TRACE precision/gates; SHIFT direction/card/rule cues; actual-play +3s consumption/retries and safe pending resume. Countdown now uses countVisible. Challenge sessions carry existing sanitized ghosts through the same commitment/delay gates as past-self; no raw events or invented directions/angles. Archive supports loaded filtered practice playlists, server-authorizing each next game and remounting runs per token. Entitlement failures retain the queue.

Product fixes: eligible free challenge+ranked dual satisfaction; zero-charge reservation resume; exhausted technical retry protection; atomic progression/submission; non-regressing streaks; selected past-self comparison; premium archive challenge creation; archive filters and history timestamp/UUID pagination. Safe SW caching, no-store headers, fail-closed Android association and nonwriting asset preflight are implemented. ERROR_TELEMETRY_ENABLED is documented in .env.example.

Parent integrated verification: 36 test files / 257 tests passed; full lint, route generation, standalone typecheck, production webpack build (38/38), diff check and Drizzle migration check passed. All 30 content simulations valid, none impossible; four TRACE compression warnings remain without modifying published configs. All five campaign PNGs passed upload preflight, no upload performed. Read-only Neon launch status passed: SNAP today, complete persisted coverage 2026-10-19–2026-11-17, no missing dates; zero traffic/null ratios, telemetry disabled, no designated launch league. Existing Vite future-loader and outer lockfile warnings remain nonblocking.

Owner/external gates remain: visual/device/performance/audio/haptic review; production HTTPS deployment and real UTC rollover/concurrency acceptance; actual Stripe payment/webhook/portal verification; designated launch league; Android package/signing/Play release; campaign upload. No browser QA was performed. Rank designs remain explicitly unearned because no season award thresholds exist. Engine modifiers absent from shipped schemas and deferred email flows were not invented or added.

Detailed handoffs: companion CHECKPOINT-GAMES.md, CHECKPOINT-VECTORS.md and agent-pack/CHECKPOINT-PRODUCT.md. Their parent countdown/challenge transport/playlist gaps are resolved by this integration.

## Historical recovery notes


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

## Resume after owner commit aec9b22

- Previous four agents stopped at provider usage limits; their partial edits were committed by the owner. Those agents are NOT running.
- Working tree was clean on resumption. Actual baseline rerun: 217 tests passed, typecheck passed; lint had one unused drawFeedback warning in trace runner.
- New batch deleg_722dfb91 is finishing bounded remaining work: sa-0-454a6c88 gameplay runners/consume/sound; sa-1-af4b2645 challenge+ranked/archive/resume; sa-2-fa0dd046 brand vectors/CSS.
- Parent verified committed skin resolver, nine recipes/previews/cosmetics API and added account-scoped profile freshness, post-submit/payment profile invalidation, result avatar outcome states, in-app reduced result motion and DOM-only score reveal (no per-frame React state).
- Parent wired supplied rank designs as explicitly unearned profile gallery; no season thresholds were specified, so no earned rank is fabricated.
- Focused profile/cosmetics/preview/renderer regression checks: 13 passed. Scoped parent lint passed. Content simulations: all 30 valid, four TRACE compression warnings remain; Drizzle migration check passed.
- Full final integration/build/launch-status check remains pending after all writers finish. No commits or pushes by assistant.

## Parallel implementation — historical failed batch

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
