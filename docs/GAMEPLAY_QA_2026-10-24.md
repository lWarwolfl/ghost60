# Gameplay and page audit — 2026-10-24

## Behavior

- Owned past runs replay their recorded inputs and score changes on the run clock, independently of current-player input. Older stored past-self/challenge snapshots also get the race HUD. Raw choice inputs remain private to the owner; public rival ghosts retain the answer-free contract.
- Every game has action-position score feedback, at 26–36px for 1.6 seconds. Final feedback can finish before the result replaces the arena. Reduced motion keeps the label still.
- Pulse's cyan target changes size after each scoring window using a seeded sequence. Timing, authoritative scores, and recorded-run compatibility stay unchanged.
- Orbit pointer and keyboard controls both tap the moving marker. The score label is anchored to the marker's angle at input time. Public rival totals now use the scorer's interpolated points.
- Shift advances missed cards, displays the timeout feedback, and continues to the next scheduled card.
- Recall redraws immediately after canvas resizing and holds completion feedback before finishing.
- Trace updates score during movement. Owned replay trails use every recorded point, stay aligned with the ghost head, and break at separate strokes. Public trails retain their delay. Ghost sampling retains all gate calculations and the final endpoint/score.
- Archive replay draws the corresponding game board and stored actions instead of a generic timeline picture.
- Keyboard shortcuts preserve navigation controls, and game canvases are focusable.
- Fixed the Node-only telemetry import so webpack can eliminate it from Edge instrumentation.

## Verification

The app was run against an isolated local PostgreSQL-compatible PGlite database with the real schema migrations, authentication, APIs, and saved runs. Browser checks used Chromium 153. Local test users and test entitlements were used; no production data was changed.

| Check | Evidence |
| --- | --- |
| Unit suite | 291 tests, 41 files, passing |
| Focused game/page browser audit | All 12 scenarios passed: six full game runs, saved scores/replays, independent past ghosts, Shift timeout, keyboard Quit, all static pages at three widths, and dynamic pages/controls |
| Viewports | 320×740, 390×844, 1440×900; no horizontal overflow across `/`, `/play`, `/profile`, `/leagues`, `/archive`, `/archive/history`, `/ghost-plus`, `/settings`, `/privacy`, `/terms`, `/dev` |
| Dynamic pages | League creation/standings; challenge landing/preflight; running/results; replay pause/restart/speed/scrub; past-self access; missing challenge/league/run states |
| Action feedback | Browser assertions cover visible size, lifetime, Orbit impact coordinates, and rendered Pulse size changes; reduced-motion feedback checked |
| Release regression | Account deletion, analytics validation, free/premium access, league caps/permissions, duplicate/hostile submission, expired/disabled challenges, offline retry, safety and viewport/keyboard/load checks |
| Content | 30 deterministic days valid; none impossible. Existing Trace score-compression warnings remain |
| Schema | Drizzle check passed; no schema migration needed |
| Static checks | TypeScript, lint, and diff whitespace checks passed |
| Build | Webpack production build passed; source built in an isolated checkout |

The long challenge, Orbit, and Shift browser tests were repeated against the production server after development reloads interrupted initial attempts. The game/page audit and focused follow-up checks cover the final UI behavior.

## Limits

- Google OAuth verification requires configured provider credentials and is skipped when absent. A real Google account link was not attempted.
- Local test-payment entitlement confirmation was verified. Real Stripe checkout, renewal, and webhooks were not exercised without payment credentials.
- PGlite supports local flow verification; this is not production PostgreSQL concurrency/load testing. The temporary test connection pool was serialized to avoid PGlite wire-protocol multiplexing conflicts; no application pool settings were changed.
- The installed Next.js 16.4.0 CLI reported an existing security advisory. The build succeeded on the CLI's requested retry. Dependency upgrades are separate from these gameplay changes.
- Screenshots are desktop Chromium at phone viewport sizes, not physical-device or audio-listening acceptance.

## Screenshots

Orbit's score stays at the action's point on the ring:

![Orbit score feedback](qa/orbit-feedback.webp)

An owned Pulse ghost advances while the current player has no inputs:

![Owned Pulse ghost](qa/pulse-ghost.webp)
