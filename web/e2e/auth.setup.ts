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
