/// <reference types="node" />

import process from 'process';
import { defineConfig, devices } from '@playwright/test';

// Respect BASE_URL and optionally start a simple static server for local test pages.
const baseUrlFromEnv = process.env.BASE_URL;
const testServerPort = Number(process.env.TEST_SERVER_PORT ?? 8081);
const shouldStartServer = !baseUrlFromEnv || !baseUrlFromEnv.startsWith('file:');
const webServer = shouldStartServer
  ? {
      command: `npx http-server test-pages -p ${testServerPort}`,
      port: testServerPort,
      reuseExistingServer: true,
    }
  : undefined;

const baseConfig = {
  testDir: './tests',

  fullyParallel: true,

  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,

  workers: process.env.CI ? 1 : undefined,

  // Global timeouts to keep CI runs stable
  timeout: 60_000,
  expect: { timeout: 5_000 },

  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: 'playwright-report',
        open: 'never',
      },
    ],
  ],

  use: {
    // If BASE_URL is a file:// URL we don't set baseURL so tests can navigate directly.
    baseURL: baseUrlFromEnv && !baseUrlFromEnv.startsWith('file:') ? baseUrlFromEnv : undefined,

    headless: process.env.HEADLESS !== 'false',

    screenshot: 'only-on-failure',

    video: 'retain-on-failure',

    trace: 'retain-on-failure',

    actionTimeout: 0,

    viewport: {
      width: 1280,
      height: 720,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
};

// Only include webServer when it's explicitly configured to avoid undefined fields in some editors.
const finalConfig = webServer ? { ...baseConfig, webServer } : baseConfig;

export default defineConfig(finalConfig);
