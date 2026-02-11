import { defineConfig } from '@playwright/test';

// Docker relay ports
const RELAY_URLS = {
  amb: 'ws://localhost:7001',
  calendar: 'ws://localhost:7002',
  strfry: 'ws://localhost:7003',
  hanging: 'ws://localhost:9738' // Mock relay for timedPool timeout tests
};

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.test.js',

  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',

  // Run test files in parallel across workers
  // Tests within each file still run sequentially (safe for create/modify flows)
  // Using 2 workers for stability; increase for CI with more resources
  workers: process.env.CI ? 4 : 2,

  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          executablePath: process.env.CHROMIUM_BIN || 'chromium'
        }
      }
    }
  ],

  webServer: {
    command: 'pnpm run build && pnpm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      CALENDAR_RELAYS: RELAY_URLS.calendar,
      COMMUNIKEY_RELAYS: RELAY_URLS.strfry,
      AMB_RELAYS: RELAY_URLS.amb,
      LONGFORM_CONTENT_RELAY: RELAY_URLS.strfry,
      FALLBACK_RELAYS: RELAY_URLS.strfry,
      RELAY_LIST_LOOKUP_RELAYS: RELAY_URLS.strfry,
      INDEXER_RELAYS: RELAY_URLS.strfry,
      GATED_MODE_DEFAULT: 'true',
      GATED_MODE_FORCE: 'true',
      ORIGIN: 'http://localhost:4173',
      NODE_ENV: 'production',
      PORT: '4173'
    }
  }
});
