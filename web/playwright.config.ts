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
    { name: 'seed', testMatch: /seed\.setup\.ts/ },
    { name: 'setup', testMatch: /auth\.setup\.ts/, dependencies: ['seed'] },
    // Desktop viewports
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 720 } },
      dependencies: ['setup'],
    },
    // Tablet viewports
    {
      name: 'chromium-tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-tablet',
      use: { ...devices['Desktop Firefox'], viewport: { width: 768, height: 1024 } },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-tablet',
      use: { ...devices['Desktop Safari'], viewport: { width: 768, height: 1024 } },
      dependencies: ['setup'],
    },
    // Mobile viewports
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 375, height: 667 } },
      dependencies: ['setup'],
    },
    {
      name: 'firefox-mobile',
      use: { ...devices['Desktop Firefox'], viewport: { width: 375, height: 667 } },
      dependencies: ['setup'],
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 12'], viewport: { width: 375, height: 667 } },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
