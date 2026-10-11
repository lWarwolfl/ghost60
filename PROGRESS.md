# Ghost60 — Progress tracker (working implementation status)

Source of truth for product behavior stays in the docs folder (`ai-generated-junk/ghost60/agent-pack/`). This file tracks what is DONE in code.

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
- [ ] Phase 14 — Release QA (bundle, CPU, E2E matrix, anti-cheat fuzz, SEO, OAuth, backup)
- [ ] Phase 15 — Launch (seed schedule, launch league, rollover, monitoring)
- [ ] Phase 16 — Play Store via Bubblewrap (needs production domain + signing key; see checklist)
- [ ] Deferred — Email flows (plan: pack `docs/EMAIL_FLOWS.md`; Gmail SMTP + Ghost60 template mirroring perfectest-cv; no-spec-change flows vs proposed invite/reminder flows)
- [x] Client-first game shell on App Router (owner chose over Page Router migration; see `docs/PAGE_ROUTER_MIGRATION.md` — stable draw loops, code-split runners, prefetched run route, instant preflight; submit/session unchanged)

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
