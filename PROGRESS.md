# Ghost60 — Progress tracker (working implementation status)

Source of truth for product behavior stays in the docs folder (`ai-generated-junk/ghost60/agent-pack/`). This file tracks what is DONE in code.

## Integrated completion — 2026-10-19

- [x] Nine entitled skins, synchronized previews, profile equip, six gameplay avatars, TRACE trail and result card integration; cosmetic changes preserve target contrast, timing and authoritative scores.
- [x] Six icon/vector motion states, unique SVG IDs, reduced/hidden motion handling; all sixteen source vectors byte-identical. Season-rank designs remain explicitly unearned pending an award policy.
- [x] Countdown interstitial/GO wiring, actual-play consumption/retry/resume, TRACE precision/gates, SHIFT card/direction/rule feedback and privacy-gated challenge/past-self sanitized ghosts.
- [x] Eligible challenge+ranked dual satisfaction, zero-charge reservation resume, exhausted retry protection, atomic progression/submission and non-regressing streaks.
- [x] Archive filters/pagination, owned past-self targets, premium archive challenge creation, history keyset pagination/charts and sequential practice playlist for loaded filtered archive games. Every next game is authorized server-side; entitlement failure retains the queue.
- [x] Account-scoped profile refresh after runs/payments, safe static-only SW/offline shell, no-store headers, Android association validation, asset preflight and opt-in server error telemetry.
- [x] Parent final verification: 257 tests across 36 files; lint, route generation, typecheck, webpack production build, diff check and Drizzle check passed. All 30 content simulations valid; four TRACE compression warnings remain. Five campaign asset inputs ready, not uploaded.
- [x] Read-only Neon status: current SNAP valid, no missing dates from 2026-10-19 through 2026-11-17. This is schedule/config readiness only; no traffic samples, telemetry disabled and no designated launch league.
- [ ] Owner visual/device/performance/audio review, production deployment/live rollover/concurrency, real Stripe acceptance, launch league, campaign upload and Android signing/Play release remain unverified. No browser checks performed in this pass. Changes are uncommitted.

Historical milestones below retain their original test counts and past E2E reports; they are not fresh browser verification. Current code status above supersedes old deferred/Stripe-paused descriptions.

## Milestones

- [x] Phase 0 — Scaffold (Next 16.4.0, React 19.3.0, TS 5, Tailwind v4, baseline deps, folders, `npm run build` + eslint + `drizzle-kit check` green)
- [x] Phase 1 — DB + auth (22 tables migrated to Neon, Better Auth anonymous + Google, transactional anonymous→Google link migration, profile bootstrap, guest session verified live)
- [x] Phase 2 — Deterministic core (mulberry32 PRNG, event validator, runtime state machine, pure-TS SHA-256 digest, all six engine scorers + sanitizeGhost + simulate, 18 unit tests green)
- [x] Phase 3 — Ranked lifecycle (HMAC session token, session/consume/submit routes, consumed-at rule, technical retry, Ghost+ mode gates, challenge outcome; streak/XP/achievements deferred to Phase 6, ranked+challenge dual-satisfaction deferred to Phase 5)
- [x] Phase 4 — PULSE + SNAP slice (Canvas 2D runners, countdown state machine, WebAudio cues, motion/sound prefs in `/settings`, IndexedDB offline buffer with retry, preflight + run + result screens, headless-Chromium full-run E2E green)
- [x] Phase 5 — Viral loop (challenge create/disable API, public landing with expired states, dynamic OG cards + metadata, anonymous race flow, frozen win/loss/tie, revenge challenges, Web Share + copy fallback; ranked+challenge dual-satisfaction still deferred)
- [x] Phase 6 — Progression (UTC-safe streaks + grace economy, idempotent XP ledger, level curve, 10 achievement unlocks, `/profile` with level/streak/7-day history; league XP + `league_signal` deferred to Phase 7)
- [x] Phase 7 — Leagues (invite slug, create 1/join 3/size 12 caps server-enforced + Ghost+ 5/10, best-5-of-7 NORMALIZED percentile standings, sanitized invites, participation XP, owner transfer/archive; unit + live E2E join/leave/standings green)
- [x] Phase 8 — Remaining engines (all six playable: ORBIT/RECALL/SHIFT/TRACE fixtures + sim distributions + runners + ghost-gated visuals + a11y, 85 unit green, live canvas E2Es green, build+eslint green)
- [x] Phase 9 — Content (30-day SIGNAL LOST schedule: deterministic builder mapping pack modifiers onto engine schemas with cap clamps, rule validation, low/med/high sims with impossible/compression/outlier flags, `content:check` + `content:import` with skip-existing immutability; live import 2026-11-09..2026-12-08 verified + idempotent re-run)
- [x] Phase 10 — Ghost+ LOCKED, no Stripe (requireGhostPlus() deny-by-default on past-self/practice-cap/archive/history-depth/premium cosmetics; free archive 7-day + locked teasers; free skins equip with avatar preview, premium 403; locked upsell UI; unit + tamper E2E green, ranked untouched)
- [x] Phase 11.5 — PWA installable + Bubblewrap/TWA readiness (icons, manifest, SW, metadata, `/settings` update + cache-clear page)
- [x] Phase 11 — Media (no user uploads launched: no upload-auth route by decision, ImageKit private key server-only in the campaign script, fixed 5-PNG allowlist, no replay/SVG art to ImageKit; guardrail unit tests green)
- [x] Phase 12 — Safety/privacy (transactional account deletion with FK-safe cascade incl. owned-challenge cleanup + league transfer/archive, block-by-handle/unblock, allowlisted reports with challenge/league UI entry points, DB-backed rate_limits with single-roundtrip upsert on session/submit/challenge/cosmetics/report/block/delete, privacy+terms pages with footer links; rate-limit unit + deletion/safety E2Es green)
- [x] Phase 13 — Analytics (first-party `product_events` via batched `POST /api/events` with 28-name allowlist, ≤25/batch + 32KB + flat-scalar-prop caps, anonId SHA-256 hashed server-side, auth-required + per-user rate limit, no vendor SDK; funnel wiring across session/submit/challenge/league/share/landing/paywall; SQL notes for activation, challenge funnel, D1/D7, conversion in `docs/ANALYTICS.md`; validator unit + ingest/hash E2E + live client-flush E2E green)
- [x] Phase 14 — Release QA (seeded anti-cheat fuzz over all six engines, idempotent-duplicate + fabricated-storm + offline-retry + expired/disabled E2E paths, 6-viewport overflow matrix, keyboard operability, throttled-load budget, Google consent-URL wiring, pg_dump schema backup, index/EXPLAIN inspect; fixed OG-image 500 + 320px header overflow + date-locked loop spec; full 14-file E2E matrix + 119 unit + build + eslint green, recorded in `docs/RELEASE_QA.md`)
- [ ] Phase 15 — Launch (current 30-day schedule restored and read back; readiness/monitoring command verified against Neon; launch league and production deployment still pending)
- [ ] Phase 16 — Play Store via Bubblewrap (needs production domain + signing key; see checklist)
- [ ] Deferred — Email flows (plan: pack `docs/EMAIL_FLOWS.md`; Gmail SMTP + Ghost60 template mirroring perfectest-cv; no-spec-change flows vs proposed invite/reminder flows)
- [x] Client-first game shell on App Router (owner chose over Page Router migration; see `docs/PAGE_ROUTER_MIGRATION.md` — stable draw loops, code-split runners, prefetched run route, instant preflight; submit/session unchanged)

## Availability repair and charge policy

- Confirmed the live database had no 2026-10-18 game; its authored schedule started 2026-11-09. Imported the missing current window without modifying existing days: 22 inserted, 8 preserved, all 30 dates 2026-10-18 through 2026-11-16 read back.
- Called the real today route against Neon: HTTP response 200, `FIRST SIGNAL`, `pulse`, 45000ms, daily ID `3e0862be-84a0-455c-b105-5086c3b7b506`.
- Missing current-day content now generates from the authored rotation in production, with conflict-safe inserts and preservation of disabled/retired days. Daily regression tests: 17 passed.
- Fixed script/test `.env` CRLF parsing with Node `util.parseEnv`; the previous regex silently skipped DATABASE_URL. Regression reproduced missing values, then passed. This was separate from Next's own env loading.
- Charge/payment work supersedes the old Stripe pause. Free policy: five daily charges, one ranked attempt, free challenge races. Paid policy: unlimited unranked practice. Provider configuration and acceptance checks: `docs/BILLING.md`.
- Local `/ghost-plus` now has explicit test-payment confirmation and reset: 24-hour server-side test access, no gateway or real charge, guests supported. Production rejects grants and ignores stored test entitlements. Final verification: 188 unit tests, full lint, typecheck and production build passed; no browser checks or live card transactions.
- `npm run build` now uses webpack: the installed Next 16.4 Turbopack font resolver failed on Archivo. The real webpack production build passed, including all new billing/charge routes. Removed invalid arbitrary exports from two challenge pages exposed by the build check.
- `npm run launch:status` verified complete coverage and valid current content against Neon. It reports zero traffic as null ratios, missing error telemetry as unavailable, and existing leagues as undesignated; it does not claim production launch readiness.

## Assets

- Needed/generated raster list (GPT Plus jobs, specs + prompts): `agent-pack/docs/ASSET_REQUESTS.md` in the docs folder.
- Awaiting from owner: ~~default OG image, Twitter image, Play feature graphic, email header~~ all received 2026-10-07 (optional: hero texture, static share fallbacks — also received).
- Campaign art upload to ImageKit `/ghost60` still pending (no network egress from build machine; run `npm run assets:upload` from a connected machine).
- Code will consume them as: `src/app/opengraph-image.png`, `src/app/twitter-image.png`, ImageKit `/ghost60` folder, Phase 16 release folder.

## Bubblewrap / TWA launch checklist (deferred to deploy time)

- [ ] Production HTTPS domain (installability + TWA requirement)
- [ ] Generate Android signing key (`bubblewrap init --manifest https://<domain>/manifest.webmanifest`)
- [ ] `/.well-known/assetlinks.json` serving Play package SHA-256 fingerprint
- [ ] Verify `start_url`, `display: standalone`, 512px + maskable icons pass Lighthouse PWA audit
- [ ] Play listing assets (feature graphic, screenshots at 320/375/390/430px)

## Deviations from `agent-pack` (deliberate, pack invariant wins on conflict)

- `user` table: added `isAnonymous` (anonymous plugin requirement).
- `session` table: added nullable `ipAddress`, `userAgent` (better-auth 1.7.2 requires the columns to exist).
- `account` table: added nullable `issuer` (better-auth account model field).
- `auth` config declares `user.additionalFields.role` (maps the pack's `role` column).
- React/Next float to latest stable per Hermes upgrade policy (16.4.0 / 19.3.0 at scaffold).
- Auth client uses same-origin (`window.location.origin`) instead of hardcoded `localhost:3000`, so dev ports and preview deploys work.
- E2E runs against `http://localhost:3104` (see `playwright.config.ts`); start dev with `npm run dev -- -p 3104` before `npm run test:e2e`.
