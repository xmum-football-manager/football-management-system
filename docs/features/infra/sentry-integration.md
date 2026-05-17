# sentry-integration

## What & Why

`@sentry/nextjs` is already in package.json but zero Sentry config files exist. Without them, errors are not captured — the package is dead weight. This sub-feature wires the minimal config needed to capture unhandled exceptions from client, server, and edge runtimes.

## Files Created

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Browser SDK init |
| `sentry.server.config.ts` | Node.js SDK init |
| `sentry.edge.config.ts` | Edge runtime SDK init |
| `next.config.ts` (modified) | Wrap with `withSentryConfig` |
| `.env.example` (modified) | Add `NEXT_PUBLIC_SENTRY_DSN` placeholder |

## Environment Variable

`NEXT_PUBLIC_SENTRY_DSN` — set this to the project DSN from sentry.io. When unset, Sentry silently disables itself (no crashes in local dev without a DSN).

## Behaviour

- Captures unhandled exceptions and promise rejections automatically
- No custom error boundaries required
- `tracesSampleRate: 0.1` in production to avoid burning free quota
