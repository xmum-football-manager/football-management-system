import { test, expect } from '@playwright/test';

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
