import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: [
    {
      command: 'npm.cmd --prefix ../server run dev',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'npm.cmd run dev -- --host localhost',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chrome',
      testIgnore: [
        '**/walkthrough.spec.ts',
        '**/deep-walkthrough.spec.ts',
        '**/all-roles.spec.ts',
        '**/comprehensive.spec.ts',
        '**/question-import.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
      },
    },
    {
      name: 'walkthrough',
      testMatch: '**/walkthrough.spec.ts',
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        launchOptions: { slowMo: 400 },
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'deep-walkthrough',
      testMatch: '**/deep-walkthrough.spec.ts',
      retries: 0,
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        launchOptions: { slowMo: 400 },
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'all-roles',
      testMatch: '**/all-roles.spec.ts',
      retries: 0,
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        launchOptions: { slowMo: 200 },
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'comprehensive',
      testMatch: '**/comprehensive.spec.ts',
      retries: 0,
      timeout: 240_000,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        launchOptions: { slowMo: 200 },
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'question-import',
      testMatch: '**/question-import.spec.ts',
      retries: 1,
      timeout: 60_000,
      use: {
        ...devices['Desktop Chrome'],
        channel: process.env.PW_CHANNEL || 'chrome',
        launchOptions: { slowMo: 150 },
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
});
