import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"
import { createTestUser, setSubscription, clearEmulatorData } from "../fixtures/firebase-helpers"

const TEST_EMAIL = `golden-${Date.now()}@icecap-test.com`
const TEST_PASSWORD = "GoldenPath123!"
let testUid = ""

// Custom fixture
const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async (_, use) => {
    const extensionPath = path.join(__dirname, "../../apps/extension/build/chrome-mv3-dev")
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-sandbox",
      ],
    })
    await use(context)
    await context.close()
  },
  extensionId: async ({ context }, use) => {
    let [background] = context.serviceWorkers()
    if (!background) background = await context.waitForEvent("serviceworker")
    await use(background.url().split("/")[2])
  },
})

test.beforeAll(async () => {
  testUid = await createTestUser(TEST_EMAIL, TEST_PASSWORD)
  await setSubscription(testUid, "active", "pro")
})

test.afterAll(async () => {
  await clearEmulatorData()
})

test("golden path: Hub login page is accessible", async ({ page }) => {
  await page.goto("http://localhost:5173/login")
  await expect(page.locator("h1")).toContainText("Icecap Hub")
  await expect(page.getByTestId("google-signin-btn")).toBeVisible()
})

test("golden path: Side panel loads in extension", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await expect(page.getByText("Analyze Active Listing")).toBeVisible()
})

test("golden path: Manual analysis + metrics display", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Fill in property data manually
  const inputs = page.locator("input[type='number']")
  await inputs.nth(0).fill("400000") // price
  await inputs.nth(0).press("Tab")
  await inputs.nth(1).fill("2500")   // rent
  await inputs.nth(1).press("Tab")

  // Verify the result card shows meaningful metrics
  const resultCard = page.locator(".bg-blue-600")
  await expect(resultCard).toBeVisible()
  await expect(page.getByText("Monthly Cash Flow")).toBeVisible()
  await expect(page.getByText("Cap Rate")).toBeVisible()
})
