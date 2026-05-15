import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

let tournamentId: string;
test.beforeAll(() => {
  const testData = JSON.parse(readFileSync('playwright/.test-data.json', 'utf-8'));
  tournamentId = testData.tournamentId;
});

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

    await page.goto(`/admin/tournaments/${tournamentId}`);
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
