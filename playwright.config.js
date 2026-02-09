import { defineConfig } from '@playwright/test';

const RELAY_PORT = 9737;
const HANGING_RELAY_PORT = 9738;
const RELAY_URL = `ws://localhost:${RELAY_PORT}`;
const _HANGING_RELAY_URL = `ws://localhost:${HANGING_RELAY_PORT}`; // Reserved for future tests

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.test.js',

  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',

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
      CALENDAR_RELAYS: RELAY_URL,
      COMMUNIKEY_RELAYS: RELAY_URL,
      AMB_RELAYS: RELAY_URL, // Temporarily using only normal relay to test pagination
      LONGFORM_CONTENT_RELAY: RELAY_URL,
      FALLBACK_RELAYS: RELAY_URL,
      RELAY_LIST_LOOKUP_RELAYS: RELAY_URL,
      INDEXER_RELAYS: RELAY_URL,
      GATED_MODE_DEFAULT: 'true',
      GATED_MODE_FORCE: 'true',
      ORIGIN: 'http://localhost:4173',
      NODE_ENV: 'production',
      PORT: '4173'
    }
  }
});
