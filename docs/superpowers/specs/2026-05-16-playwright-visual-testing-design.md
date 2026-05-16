# Playwright Visual Testing Design

## Overview

Set up Playwright as the primary visual regression testing tool for the football manager web app. Replace reliance on Chromatic with a self-hosted Playwright-based solution that provides multi-browser screenshot comparison, auto-login for authenticated flows, and comprehensive error detection.

## Goals

- Visual regression testing with screenshot comparison across browsers
- Full coverage: 3 browsers × 3 viewports = 9 test projects
- Auto-login with test credentials for authenticated page testing
- Error detection: console errors, network failures, page crashes, resource errors
- CI integration via GitHub Actions

## Architecture

### File Structure

```
web/
├── playwright.config.ts          # Main Playwright configuration
├── tests/
│   ├── auth.setup.ts             # Authentication setup (login once)
│   ├── visual/
│   │   ├── homepage.spec.ts      # Public page visual tests
│   │   ├── dashboard.spec.ts     # Authenticated page tests
│   │   ├── tournament.spec.ts    # Tournament page tests
│   │   ├── responsive.spec.ts    # Responsive breakpoint tests
│   │   └── error-detection.spec.ts # Error monitoring tests
│   └── visual/
│       └── snapshots/            # Baseline screenshots (committed)
└── .github/
    └── workflows/
        └── visual-tests.yml      # CI workflow
```

### 1. Playwright Configuration

**File:** `playwright.config.ts`

- **Projects:** 9 total (Chromium, Firefox, WebKit × Desktop, Tablet, Mobile)
- **Viewports:**
  - Desktop: 1280×720
  - Tablet: 768×1024
  - Mobile: 375×667
- **Screenshot threshold:** 0.2 (2% pixel difference tolerance)
- **Base URL:** `http://localhost:3000` (configurable via `BASE_URL` env var)
- **Storage state:** `playwright/.auth/user.json` for authenticated tests
- **Retry:** 1 retry on failure

### 2. Authentication Setup

**File:** `tests/auth.setup.ts`

- Reads `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` from environment
- Navigates to `/login` page
- Fills email and password fields
- Submits form and waits for redirect to `/dashboard`
- Saves `storageState` to `playwright/.auth/user.json`
- All authenticated tests reuse this state (no re-login per test)

**Environment Variables:**
- `TEST_USER_EMAIL` — Test user email
- `TEST_USER_PASSWORD` — Test user password
- `BASE_URL` — App URL (defaults to `http://localhost:3000`)

### 3. Visual Regression Tests

Each test follows this pattern:
1. Navigate to page (authenticated or public)
2. Wait for content to load (`networkidle`)
3. Take screenshot → compared against baseline
4. Fail if difference exceeds threshold

**Test Files:**
- `homepage.spec.ts` — Public homepage screenshots
- `dashboard.spec.ts` — Authenticated dashboard screenshots
- `tournament.spec.ts` — Tournament page screenshots
- `responsive.spec.ts` — Same page at different viewports

**Snapshots:** Stored in `tests/visual/snapshots/` and committed to git
**Update command:** `pnpm playwright test --update-snapshots`

### 4. Error Detection

**File:** `tests/visual/error-detection.spec.ts`

Integrated into all tests, monitors:

- **Console errors** — `page.on('console', msg => if (msg.type() === 'error') capture)`
- **Network failures** — 4xx/5xx HTTP responses
- **Page crashes** — Uncaught exceptions via `page.on('pageerror')`
- **Resource errors** — Broken images, missing CSS/JS files

Test fails if any errors detected during page load.

### 5. CI/CD Integration

**File:** `.github/workflows/visual-tests.yml`

- **Trigger:** Pull requests to `main` branch
- **Steps:**
  1. Checkout code
  2. Install dependencies (`pnpm install`)
  3. Install Playwright browsers (`pnpm playwright install --with-deps`)
  4. Build Next.js app (`pnpm build`)
  5. Run Playwright visual tests (`pnpm playwright test`)
  6. Upload screenshot diffs as artifacts on failure
- **Artifacts:** `test-results/` directory (screenshots, traces)

## Dependencies

### New Packages

- `@playwright/test` — Playwright test runner (already have `playwright` + `@vitest/browser-playwright`)

### Scripts to Add

```json
{
  "test:visual": "playwright test",
  "test:visual:update": "playwright test --update-snapshots",
  "test:visual:ui": "playwright test --ui"
}
```

## Success Criteria

- All 9 Playwright projects run successfully
- Screenshot baselines are generated and committed
- Auto-login works for authenticated page tests
- Error detection catches console/network/crash errors
- CI workflow runs on PRs and fails on visual regressions
- Screenshot diffs are uploaded as artifacts on failure
