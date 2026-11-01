import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4321', trace: 'off', screenshot: 'off' },
  webServer: {
    command: 'node scripts/serve-test.mjs',
    port: 4321,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], channel: process.env.TEST_CHROME_CHANNEL || undefined } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'], channel: process.env.TEST_CHROME_CHANNEL || undefined } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
