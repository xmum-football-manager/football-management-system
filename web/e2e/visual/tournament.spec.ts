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
