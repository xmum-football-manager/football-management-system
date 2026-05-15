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
