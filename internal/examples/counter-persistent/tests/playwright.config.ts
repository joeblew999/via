import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Via counter-persistent tests
 *
 * See https://playwright.dev/docs/test-configuration
 *
 * Run modes:
 * - Headless (default):     bun playwright test
 * - Headed (see browser):   bun playwright test --headed
 * - UI mode (interactive):  bun playwright test --ui
 * - Debug (step through):   bun playwright test --debug
 */
export default defineConfig({
  testDir: './specs',

  // Ignore archived tests
  testIgnore: '**/archived/**',

  // Run tests in files in parallel
  fullyParallel: false,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Workers: 1 = sequential (needed for multi-window tests)
  workers: 1,

  // Reporter to use
  reporter: [
    ['html'],
    ['list']
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'https://localhost:3443',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Ignore HTTPS errors (we're using self-signed certs)
    ignoreHTTPSErrors: true,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Uncomment to test on mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run your local dev server before starting the tests
  // webServer: {
  //   command: 'task dev',
  //   url: 'https://localhost:3443',
  //   reuseExistingServer: !process.env.CI,
  //   ignoreHTTPSErrors: true,
  // },
});
