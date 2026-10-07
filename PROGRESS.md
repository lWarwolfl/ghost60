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
- [ ] Phase 7 — Leagues (invite slug, best-5-of-7 NORMALIZED standings)
- [ ] Phase 8 — Remaining engines (ORBIT → RECALL → SHIFT → TRACE, one at a time)
- [ ] Phase 9 — Content (30-day schedule import + validators + simulations)
- [ ] Phase 10 — Ghost+ LOCKED, no Stripe (`requireGhostPlus()` deny-by-default, locked UI)
- [x] Phase 11.5 — PWA installable + Bubblewrap/TWA readiness (icons, manifest, SW, metadata, `/settings` update + cache-clear page)
- [ ] Phase 11 — Media (ImageKit upload-auth only if uploads launch)
- [ ] Phase 12 — Safety/privacy (deletion, disable, block/report, rate limits, legal, a11y settings)
- [ ] Phase 13 — Analytics (first-party `product_events`, funnel notes, no vendor SDK)
- [ ] Phase 14 — Release QA (bundle, CPU, E2E matrix, anti-cheat fuzz, SEO, OAuth, backup)
- [ ] Phase 15 — Launch (seed schedule, launch league, rollover, monitoring)
- [ ] Phase 16 — Play Store via Bubblewrap (needs production domain + signing key; see checklist)
- [ ] Deferred — Email flows (plan: pack `docs/EMAIL_FLOWS.md`; Gmail SMTP + Ghost60 template mirroring perfectest-cv; no-spec-change flows vs proposed invite/reminder flows)

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
