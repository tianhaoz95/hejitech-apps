import { defineConfig, devices } from "@playwright/test"

// Separate Playwright config for promo screenshot capture.
// Run with: pnpm --filter @icecap/tests run capture:promo
// No webServer needed — navigates to external listing sites directly.

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    trace: "off",
    screenshot: "off",
  },
  projects: [
    {
      name: "promo-capture",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      },
      testMatch: ["tests/capture-promo-screenshots.ts"],
    },
  ],
})
