# Playwright Visual Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [`) syntax for tracking.

**Goal:** Set up Playwright as the primary visual regression testing tool with multi-browser screenshots, auto-login, and error detection.

**Architecture:** Playwright config with 9 projects (3 browsers × 3 viewports), auth setup via env vars, visual regression tests for key pages, error detection integrated into all tests, and GitHub Actions CI workflow.

**Tech Stack:** Playwright, Next.js 16, TypeScript, GitHub Actions

---

## File Structure

```
web/
├── playwright.config.ts              # Main configuration
├── tests/
│   ├── auth.setup.ts                 # Login + storage state
│   └── visual/
│       ├── homepage.spec.ts          # Public page tests
│       ├── admin.spec.ts             # Admin page tests
│       ├── tournament.spec.ts        # Tournament page tests
│       ├── responsive.spec.ts        # Responsive breakpoint tests
│       └── error-detection.spec.ts   # Error monitoring
└── .github/workflows/
    └── visual-tests.yml              # CI workflow
```

---

### Task 1: Install Playwright and Create Config

**Files:**
- Create: `web/playwright.config.ts`
- Modify: `web/package.json` (add scripts)

- [ ] **Step 1: Create Playwright config**

```typescript
// web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Desktop viewports
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
    },
    // Tablet viewports
    {
      name: 'chromium-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'firefox-tablet',
      use: { ...devices['Desktop Firefox'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'webkit-tablet',
      use: { ...devices['Desktop Safari'], viewport: { width: 768, height: 1024 } },
    },
    // Mobile viewports
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 667 } },
    },
    {
      name: 'firefox-mobile',
      use: { ...devices['Desktop Firefox'], viewport: { width: 375, height: 667 } },
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12'], viewport: { width: 375, height: 667 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

- [ ] **Step 2: Add scripts to package.json**

```json
{
  "scripts": {
    "test:visual": "playwright test",
    "test:visual:update": "playwright test --update-snapshots",
    "test:visual:ui": "playwright test --ui",
    "test:visual:report": "playwright show-report"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add web/playwright.config.ts web/package.json
git commit -m "test: add Playwright configuration with 9 browser projects"
```

---

### Task 2: Create Auth Setup

**Files:**
- Create: `web/tests/auth.setup.ts`
- Create: `web/.gitignore` entry for `playwright/.auth/`

- [ ] **Step 1: Create auth setup file**

```typescript
// web/tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('#email');

  // Fill credentials from environment variables
  await page.fill('#email', process.env.TEST_USER_EMAIL || '');
  await page.fill('#password', process.env.TEST_USER_PASSWORD || '');

  // Submit login form (click Admin tab first to ensure correct context)
  await page.click('button:has-text("Admin")');
  await page.click('button:has-text("Sign in as Admin")');

  // Wait for redirect to admin dashboard
  await page.waitForURL('/admin');

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
```

- [ ] **Step 2: Update Playwright config to use auth project**

Replace the projects array in `web/playwright.config.ts` with:

```typescript
projects: [
  { name: 'setup', testMatch: /.*\.setup\.ts/ },
  // Desktop viewports
  {
    name: 'chromium-desktop',
    use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  {
    name: 'firefox-desktop',
    use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  {
    name: 'webkit-desktop',
    use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  // Tablet viewports
  {
    name: 'chromium-tablet',
    use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  {
    name: 'firefox-tablet',
    use: { ...devices['Desktop Firefox'], viewport: { width: 768, height: 1024 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  {
    name: 'webkit-tablet',
    use: { ...devices['Desktop Safari'], viewport: { width: 768, height: 1024 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  // Mobile viewports
  {
    name: 'chromium-mobile',
    use: { ...devices['Pixel 5'], viewport: { width: 375, height: 667 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  {
    name: 'firefox-mobile',
    use: { ...devices['Desktop Firefox'], viewport: { width: 375, height: 667 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
  {
    name: 'webkit-mobile',
    use: { ...devices['iPhone 12'], viewport: { width: 375, height: 667 }, storageState: 'playwright/.auth/user.json' },
    dependencies: ['setup'],
  },
],
```

- [ ] **Step 3: Add .gitignore entry**

```gitignore
# Playwright
playwright/.auth/
playwright-report/
test-results/
```

- [ ] **Step 4: Commit**

```bash
git add web/tests/auth.setup.ts web/.gitignore web/playwright.config.ts
git commit -m "test: add Playwright auth setup with env var credentials"
```

---

### Task 3: Create Homepage Visual Tests

**Files:**
- Create: `web/tests/visual/homepage.spec.ts`

- [ ] **Step 1: Create homepage test**

```typescript
// web/tests/visual/homepage.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('matches baseline screenshot', async ({ page }) => {
    // Collect errors during page load
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify no errors occurred
    expect(errors).toEqual([]);

    // Visual regression check
    await expect(page).toHaveScreenshot('homepage.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Generate initial snapshots**

Run: `pnpm playwright test tests/visual/homepage.spec.ts --update-snapshots`

- [ ] **Step 3: Verify snapshots exist**

Run: `ls -la web/tests/visual/homepage.spec.ts-snapshots/`

- [ ] **Step 4: Commit**

```bash
git add web/tests/visual/homepage.spec.ts web/tests/visual/homepage.spec.ts-snapshots/
git commit -m "test: add homepage visual regression tests"
```

---

### Task 4: Create Admin Page Visual Tests

**Files:**
- Create: `web/tests/visual/admin.spec.ts`

- [ ] **Step 1: Create admin page test**

```typescript
// web/tests/visual/admin.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('dashboard matches baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await expect(page).toHaveScreenshot('admin-dashboard.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('tournaments page matches baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/tournaments');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await expect(page).toHaveScreenshot('admin-tournaments.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('users page matches baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await expect(page).toHaveScreenshot('admin-users.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});
```

- [ ] **Step 2: Generate initial snapshots**

Run: `pnpm playwright test tests/visual/admin.spec.ts --update-snapshots`

- [ ] **Step 3: Commit**

```bash
git add web/tests/visual/admin.spec.ts web/tests/visual/admin.spec.ts-snapshots/
git commit -m "test: add admin page visual regression tests"
```

---

### Task 5: Create Tournament Page Visual Tests

**Files:**
- Create: `web/tests/visual/tournament.spec.ts`

- [ ] **Step 1: Create tournament page test**

```typescript
// web/tests/visual/tournament.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tournament Pages', () => {
  test('login page matches baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('login page shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('#email');

    await page.fill('#email', 'invalid@example.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button:has-text("Sign in as Admin")');

    // Wait for error message
    await page.waitForSelector('.text-red-600');

    await expect(page).toHaveScreenshot('login-error.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });

  test('tournament public page matches baseline', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    // Navigate to a tournament page (adjust ID as needed)
    await page.goto('/t/test-tournament');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);

    await expect(page).toHaveScreenshot('tournament-public.png', {
      fullPage: true,
      threshold: 0.2,
    });
  });
});
```

- [ ] **Step 2: Generate initial snapshots**

Run: `pnpm playwright test tests/visual/tournament.spec.ts --update-snapshots`

- [ ] **Step 3: Commit**

```bash
git add web/tests/visual/tournament.spec.ts web/tests/visual/tournament.spec.ts-snapshots/
git commit -m "test: add tournament page visual regression tests"
```

---

### Task 6: Create Responsive Breakpoint Tests

**Files:**
- Create: `web/tests/visual/responsive.spec.ts`

- [ ] **Step 1: Create responsive test**

```typescript
// web/tests/visual/responsive.spec.ts
import { test, expect, devices } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 667 },
];

test.describe('Responsive Layout', () => {
  for (const viewport of viewports) {
    test(`homepage at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`homepage-${viewport.name}.png`, {
        fullPage: true,
        threshold: 0.2,
      });
    });

    test(`login at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveScreenshot(`login-${viewport.name}.png`, {
        fullPage: true,
        threshold: 0.2,
      });
    });
  }
});
```

- [ ] **Step 2: Generate initial snapshots**

Run: `pnpm playwright test tests/visual/responsive.spec.ts --update-snapshots`

- [ ] **Step 3: Commit**

```bash
git add web/tests/visual/responsive.spec.ts web/tests/visual/responsive.spec.ts-snapshots/
git commit -m "test: add responsive breakpoint visual tests"
```

---

### Task 7: Create Error Detection Tests

**Files:**
- Create: `web/tests/visual/error-detection.spec.ts`

- [ ] **Step 1: Create error detection test**

```typescript
// web/tests/visual/error-detection.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Error Detection', () => {
  test('homepage has no JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(jsErrors).toEqual([]);
  });

  test('homepage has no console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(consoleErrors).toEqual([]);
  });

  test('homepage has no failed network requests', async ({ page }) => {
    const failedRequests: { url: string; status: number }[] = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(failedRequests).toEqual([]);
  });

  test('homepage has no broken images', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images = await page.locator('img').all();
    for (const img of images) {
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('admin dashboard has no errors (authenticated)', async ({ page }) => {
    page.use({ storageState: 'playwright/.auth/user.json' });

    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    const failedRequests: { url: string; status: number }[] = [];
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('login page has no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add web/tests/visual/error-detection.spec.ts
git commit -m "test: add comprehensive error detection tests"
```

---

### Task 8: Create GitHub Actions CI Workflow

**Files:**
- Create: `.github/workflows/visual-tests.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/visual-tests.yml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    env:
      BASE_URL: http://localhost:3000

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: web/pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install
        working-directory: web

      - name: Install Playwright browsers
        run: pnpm playwright install --with-deps
        working-directory: web

      - name: Build Next.js app
        run: pnpm build
        working-directory: web

      - name: Run Playwright visual tests
        run: pnpm test:visual
        working-directory: web
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}

      - name: Upload test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: |
            web/test-results/
            web/playwright-report/
          retention-days: 7

      - name: Upload screenshot diffs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: screenshot-diffs
          path: web/tests/visual/*-snapshots/
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/visual-tests.yml
git commit -m "ci: add Playwright visual regression tests workflow"
```

---

### Task 9: Run All Tests and Verify

- [ ] **Step 1: Run full test suite locally**

Run: `cd web && pnpm test:visual`

Expected: All tests pass (or generate snapshots on first run)

- [ ] **Step 2: Verify snapshot structure**

Run: `find web/tests/visual -name "*.png" | head -20`

Expected: Screenshot files exist for each test

- [ ] **Step 3: Test snapshot update workflow**

Run: `cd web && pnpm test:visual:update`

Expected: Snapshots regenerate without errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "test: complete Playwright visual testing setup"
```

---

## Self-Review Checklist

- [ ] All 9 Playwright projects configured (3 browsers × 3 viewports)
- [ ] Auth setup uses env vars (TEST_USER_EMAIL, TEST_USER_PASSWORD)
- [ ] Visual regression tests for homepage, admin, tournament, responsive
- [ ] Error detection covers console, network, page crashes, broken images
- [ ] CI workflow runs on PRs with artifact upload on failure
- [ ] Package.json scripts added (test:visual, test:visual:update, test:visual:ui, test:visual:report)
- [ ] .gitignore excludes playwright/.auth/, test-results/, playwright-report/
- [ ] No placeholders or TODOs in any file
