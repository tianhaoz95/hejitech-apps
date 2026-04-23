import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Extensions only work in Chromium
        headless: false,
        launchOptions: {
          slowMo: 1000, // Slow down by 1 second per action
        }
      },
    },
  ],
  // We'll run our Hub in the background if needed, but for now we assume it's running
});
