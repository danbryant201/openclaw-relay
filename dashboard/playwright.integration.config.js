import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 90000,         // individual test timeout — AI responses can be slow
  globalSetup: './tests/integration/setup.js',
  globalTeardown: './tests/integration/teardown.js',
  use: {
    baseURL: 'http://localhost:3000/dashboard',
    screenshot: 'on',
    trace: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
