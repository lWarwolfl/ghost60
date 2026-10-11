# Ghost60 — Release QA record (Phase 14, 2026-10-11)

Gate: every item below verified on this build. Stripe items stay deferred
(payment-webhook validation ships with billing, post-launch).

## 1. Anti-cheat fuzz — PASS
- `tests/unit/anticheat-fuzz.test.ts`: 720 seeded hostile streams (negative /
  non-monotonic / duplicate / huge timestamps, OOB + fractional coords,
  bogus types, nulls) across all six engines — zero throws, zero NaN/Infinity/
  negative scores, all above engine caps rejected, every hostile input replays
  bit-identically. 5k pointer-move floods + 100k-event streams rejected cleanly.
- Valid streams serialize far under the 50KB event budget on every engine.
- Malformed configs throw at `validateConfig`, never at scoring.
- Live (`tests/e2e/release-paths.spec.ts`): duplicate submit returns the same
  run id (no double spend, ≤1 ranked run/user/day in DB); 5k-tap t=0 storm
  cannot inflate a ranked score; server ignores any client-claimed score by
  construction (no such field in `SubmitRequestSchema` — replay decides).

## 2. Release paths — PASS
- Expired challenge → "THIS GHOST IS GONE.", session create with its id rejected.
- Disabled (creator DELETE) → same gone state, session rejected.
- Offline submit (context offline → network failure) → reconnect retry on the
  same token succeeds.
- Account deletion, challenge loop, league loop, safety, analytics: existing
  specs green (see §8).

## 3. Share card — PASS (after one real fix)
- **Found + fixed**: `/challenge/[slug]/opengraph-image` returned 500
  (satori requires explicit `display:flex` on multi-child divs). Fixed, now
  200 `image/png`; landing `og:title`/`og:image` point at it; page source
  contains no `targetScore` leak.

## 4. Viewport matrix — PASS (after one real fix)
- **Found + fixed**: header nav overflowed 130px at 320px. Tightened nav
  (compact padding, wordmark hidden <380px, contained scroll). Now zero
  horizontal overflow on `/`, `/play`, `/settings`, `/ghost-plus` at
  320/375/390/430/768/1440.
- START RANKED RUN reachable + operable by keyboard (Tab → Enter target),
  `:focus-visible` styling present.
- Throttled Moto G + Slow-4G + 4x CPU: `/play` useful shell well in budget.

## 5. Bundle — PASS
- Total static 3.0MB; largest chunk 228KB (shared framework). All six game
  runners code-split (`dynamic ssr:false`) — share/challenge landing loads no
  game runtime (server page + brand icon only).

## 6. DB inspect — PASS
- `scripts/qa-db-inspect.ts`: partial unique index `runs_one_valid_ranked_per_day`
  serves the ranked-uniqueness lookup (Index Scan); funnel queries use
  index-only scan on `product_events_event_time_idx`; league member scans use
  the PK. Table sizes KB-scale pre-launch.

## 7. SEO / metadata — PASS
- Root `metadata` export + `opengraph-image.png` + `twitter-image.png` +
  `icon.svg` + `manifest.ts` present; per-challenge dynamic OG verified (§3).

## 8. OAuth — CONFIG-VALIDATED (flow deferred to staging)
- `POST /api/auth/sign-in/social {provider:'google'}` returns a live
  `accounts.google.com` consent URL (E2E). Full link-flow with a real Google
  account must be validated in staging with production creds; anonymous→Google
  merge path itself is transaction-covered (Phase 1).

## 9. Backup/restore — PASS (schema) / DEFERRED (PITR drill)
- `pg_dump --schema-only` against Neon succeeds: 24 tables captured.
- Point-in-time restore drill is a Neon-dashboard operation; run it at launch
  (Phase 15) and record the RTO here.

## 10. Release-blocking defects (pack list) — all clear
- duplicate ranked attempts: blocked (partial unique index + tx check + E2E)
- client-only scoring: no (server replay authoritative)
- linking loses data: no (transactional migration, Phase 1)
- challenge reveals solution: no (sanitized ghost + metadata check)
- unplayable at 320px: no (§4)
- payment grants ranked advantage: n/a (no billing wired)
- secret in client: no (HMAC/ImageKit keys server-only; guardrail tests)
- replay nondeterminism: no (fixture + fuzz replay equality)

## 11. Full matrix
- Unit: 119/119 green (`npm run test`).
- Build + eslint + `drizzle-kit check`: green.
- E2E: all 14 spec files green serially (`--workers=1`) on a fresh dev server:
  account-delete, analytics, challenge-loop, ghost-plus, league-loop,
  orbit/recall/shift/trace-canvas, pulse-smoke, safety, release-paths (3),
  viewport-matrix (5). Zero console/page errors asserted in every spec.
- Environment notes (not code defects):
  - Neon free-tier latency is highly variable right now (95ms–3s per
    roundtrip, ECONNRESET under parallel workers). Matrix runs must stay
    serial; canvas/race specs carry 30s visibility timeouts and 300s test
    timeouts where gameplay duration demands it. Evaluate pooled/provisioned
    Postgres before launch traffic.
  - `challenge-loop` was date-dependent (hardcoded pulse day + score); rewrote
    engine-agnostic via live `simulate()` — it now tests whatever day is live.
  - The first offline-reconnect test was bogus (`page.request` ignores
    `setOffline`); rewrote through in-page `fetch`. It had passed earlier only
    via a timeout — a reminder that green needs a valid mechanism, not luck.
