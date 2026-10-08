# Page Router migration — assessment (proposed, pending decision)

Goal as stated: game served mostly from client, smoother loadings without delay.

## What a full App → Pages migration touches

- 12 route handlers (`src/app/api/*`) → `src/pages/api/*`. Mechanical except auth:
  `src/lib/auth/server.ts` uses `next/headers` + React `cache` — both App-only.
  Every handler calls `getCurrentUser()`; Pages needs a cookie-based replacement
  (`auth.api.getSession` with request headers) plus rewiring all 12 routes.
- Layouts/metadata: root `layout.tsx` → `_app.tsx` + `_document.tsx`; `manifest.ts`,
  `icon.svg`, `opengraph-image.tsx` (dynamic challenge share cards — App-only
  `ImageResponse`, core to the viral loop) need manual reimplementation.
- i18n: `[locale]/(root)+(panel)` groups + next-intl App setup → next-intl Pages setup.
- 8 `page.tsx` (server) + `page.client.tsx` splits → `getServerSideProps` + page components.
- 1 server action (`ensureProfileAction`) → API route.
- Full re-verification: build + eslint + unit + all E2E (challenge loop, league loop, pulse smoke).

## Why it does not buy game smoothness

- Game rendering is already 100% client: `pulse-runner.tsx` / `snap-runner.tsx` are
  `'use client'` Canvas 2D + `requestAnimationFrame`. Router choice does not affect
  Canvas frame rate; 60fps comes from draw-loop cost, event buffering, and audio
  scheduling — none of which live in the router.
- Loadings on game screens are server roundtrips (session create, submit, today-game),
  identical under both routers. App Router client navigation (prefetch, streaming)
  is at least as smooth as Pages navigation for these transitions.

## Recommendation

Stay on App Router; do the client-first game shell instead (~5% of cost/risk):

1. `next/dynamic(ssr: false)` for runners, prefetch `/play` from home CTA.
2. Serve preflight instantly from cached today-game (`staleTime` + prefetch).
3. Keep submit/session flows as-is (already thin fetch calls, no RSC waterfalls).
4. Profile the draw loop on mid-range mobile before any architectural move.

## Decision

- [x] Owner decision (2026-10-08): client-first shell on App Router. Full Pages migration rejected.
- [x] Shipped 2026-10-08: memoized session object (draw loop no longer restarts on
  score/tap renders); memoized engine configs; Snap layout cache (no per-frame RNG
  shuffle/alloc); fixed paint style + `globalAlpha` (no per-frame string allocs);
  runners code-split via `dynamic(ssr: false)`; `/play/run` prefetched from preflight;
  today-game warmed idle on home + `staleTime` 5min for instant preflight.
- Submit/session flows unchanged (already thin fetch calls, no RSC waterfalls).
- Regression: build + eslint + 39 unit green; `/play/run` shell E2E green with zero
  console errors (canvas branch runs on pulse/snap days; placeholder branch verified
  on shift day). `pulse-smoke` spec made engine-aware (was hardcoded to pulse days).
