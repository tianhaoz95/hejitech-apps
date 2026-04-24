import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "hub",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["tests/hub.spec.ts", "tests/subscription.spec.ts"],
    },
    {
      name: "extension",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["tests/extension.spec.ts"],
    },
    {
      name: "golden-path",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["tests/golden-path.spec.ts"],
    },
  ],
  webServer: {
    command: "pnpm --filter @icecap/hub dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
