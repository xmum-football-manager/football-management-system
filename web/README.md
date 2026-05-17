# web/

Next.js application. All `pnpm` commands run from this directory.

## Day-to-day commands

```bash
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm start            # Run the production build locally
pnpm lint             # ESLint
pnpm test             # Vitest, run-once
pnpm test:watch       # Vitest, watch mode
pnpm test:coverage    # Vitest with coverage report
```

## End-to-end tests (Playwright)

Tests live in `e2e/`. They run against a real browser (Chromium, Firefox, WebKit) across desktop, tablet, and mobile viewports.

**First-time setup:**

```bash
pnpm exec playwright install --with-deps chromium
```

**Run all e2e tests:**

```bash
pnpm exec playwright test
```

**Run a specific file:**

```bash
pnpm exec playwright test e2e/visual/homepage.spec.ts
```

**Run a specific project (browser/viewport):**

```bash
pnpm exec playwright test --project=chromium-desktop
pnpm exec playwright test --project=chromium-mobile
```

**View the HTML report:**

```bash
npx playwright show-report
```

The report is generated in `playwright-report/` after each run. It includes screenshots on failure and trace files for debugging.

**Update visual baselines:**

When you intentionally change UI, update the stored screenshots:

```bash
pnpm exec playwright test --update-snapshots
```

**Writing new tests:**

- Put test files in `e2e/` (or `e2e/visual/` for visual regression tests)
- The `setup` project runs `e2e/auth.setup.ts` first — it stores auth state so other tests start logged in
- Tests run in fully parallel mode by default
- In CI, tests run with 1 worker and 1 retry
