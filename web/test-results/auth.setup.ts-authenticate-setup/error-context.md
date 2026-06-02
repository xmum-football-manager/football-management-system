# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate
- Location: e2e/auth.setup.ts:5:6

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#email') to be visible

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "This page could not be found." [level=2] [ref=e6]
  - button "Open Next.js Dev Tools" [ref=e12] [cursor=pointer]:
    - img [ref=e13]
  - alert [ref=e16]
```

# Test source

```ts
  1  | import { test as setup, expect } from '@playwright/test';
  2  | 
  3  | const authFile = 'playwright/.auth/user.json';
  4  | 
  5  | setup('authenticate', async ({ page }) => {
  6  |   // Navigate to login page
  7  |   await page.goto('/login');
  8  | 
  9  |   // Wait for login form to be ready
> 10 |   await page.waitForSelector('#email');
     |              ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  11 | 
  12 |   // Fill credentials from environment variables
  13 |   await page.fill('#email', process.env.TEST_USER_EMAIL || '');
  14 |   await page.fill('#password', process.env.TEST_USER_PASSWORD || '');
  15 | 
  16 |   // Submit login form (click Admin tab first to ensure correct context)
  17 |   await page.click('button:has-text("Admin")');
  18 |   await page.click('button:has-text("Sign in as Admin")');
  19 | 
  20 |   // Wait for redirect to admin dashboard
  21 |   await page.waitForURL('/admin');
  22 | 
  23 |   // Save authentication state
  24 |   await page.context().storageState({ path: authFile });
  25 | });
  26 | 
```