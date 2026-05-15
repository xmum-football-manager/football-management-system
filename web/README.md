# Web Application

Next.js 16 app with Playwright visual regression testing and Storybook component development.

## Visual testing

We use **Playwright** to automate UI screenshot capture across browsers and viewports, and **Storybook** for component-level development and review.

### Setup

```bash
pnpm install
pnpm exec playwright install chromium firefox webkit   # download browser binaries (one-time)
```

On Linux, WebKit requires extra system packages:

```bash
sudo apt-get install libavif16 libwoff1
```

Auth-based tests (admin, tournament pages) need credentials passed as environment variables:

```bash
export TEST_USER_EMAIL=admin@admin.com
export TEST_USER_PASSWORD=admin123
```

Then run tests:

```bash
TEST_USER_EMAIL=admin@admin.com TEST_USER_PASSWORD=admin123 pnpm test:visual
```

### Commands

```bash
pnpm test:visual          # run visual regression tests (compares against baselines)
pnpm test:visual:update   # capture/refresh baseline screenshots
pnpm test:visual:ui       # interactive Playwright UI (step through tests visually)
pnpm test:visual:report   # open HTML report from last run
pnpm storybook            # start Storybook at http://localhost:6006
pnpm build-storybook      # build static Storybook
```

### How it works

- **Playwright** takes full-page screenshots of each page and compares them against committed baselines in `tests/visual/snapshots/`.
- Tests run across **3 browsers** (Chromium, Firefox, WebKit) and **3 viewports** (desktop 1280×720, tablet 768×1024, mobile 375×667).
- On failure, diff images are saved to `test-results/` and shown in the HTML report.
- **Storybook** (`@chromatic-com/storybook` addon) provides component-level visual isolation for development.

### Updating baselines

When you intentionally change UI:

```bash
pnpm test:visual:update
```

This regenerates all baseline screenshots. Commit the updated files in `tests/visual/snapshots/`.

### Test structure

```
tests/
├── auth.setup.ts                    # login once, share auth state
└── visual/
    ├── homepage.spec.ts             # public homepage
    ├── tournament.spec.ts           # tournament pages
    ├── admin.spec.ts                # admin dashboard
    ├── responsive.spec.ts           # responsive breakpoint checks
    ├── error-detection.spec.ts      # console/network error monitoring
    └── snapshots/                   # baseline screenshots (committed)
```

### CI

Visual tests run on every PR via GitHub Actions. Failures block merge. Screenshot diffs are uploaded as artifacts for review.
