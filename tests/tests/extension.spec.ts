import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"
import { createTestUser, setSubscription, clearEmulatorData } from "../fixtures/firebase-helpers"

import fs from "fs"

const TEST_EMAIL = `ext-test-${Date.now()}@icecap-test.com`
const TEST_PASSWORD = "TestPass123!"
let testUid = ""

// Custom fixture for extension testing
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    const extensionPath = path.resolve(__dirname, "../../apps/extension/build/chrome-mv3-prod")
    
    if (!fs.existsSync(extensionPath)) {
      throw new Error(`Extension path not found: ${extensionPath}. Did you run 'pnpm build:prod' in apps/extension?`)
    }
    if (!fs.existsSync(path.join(extensionPath, "manifest.json"))) {
      throw new Error(`Manifest not found in: ${extensionPath}`)
    }

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
    const id = background.url().split("/")[2]
    await use(id)
  },
})

test.beforeAll(async () => {
  testUid = await createTestUser(TEST_EMAIL, TEST_PASSWORD)
  await setSubscription(testUid, "active", "pro")
})

test.afterAll(async () => {
  await clearEmulatorData()
})

async function signInExtension(page: any, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  
  // Wait for loader to disappear (it might be gone already)
  await page.locator("text=Initializing Icecap").waitFor({ state: "hidden", timeout: 15000 })

  // If we are not logged in, we should see the sign in button
  const loginBtn = page.getByText("Sign in with Google")
  if (await loginBtn.isVisible()) {
    await page.evaluate(async ({ email, password }) => {
      const auth = (window as any).auth
      const signIn = (window as any).signInWithEmailAndPassword
      if (!auth || !signIn) throw new Error("Firebase auth or signIn function not found on window")
      await signIn(auth, email, password)
    }, { email: TEST_EMAIL, password: TEST_PASSWORD })
  }

  // Wait for subscription check to finish
  await page.locator("text=Verifying Subscription").waitFor({ state: "hidden", timeout: 15000 })
  await expect(page.getByText(TEST_EMAIL)).toBeVisible()
}

test("shows login screen when unauthenticated", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  // Wait for loader to disappear
  await page.locator("text=Initializing Icecap").waitFor({ state: "hidden", timeout: 15000 })

  await expect(page.getByText("Welcome to Icecap")).toBeVisible()
  await expect(page.getByText("Sign in with Google")).toBeVisible()
})

test("side panel loads with calculator UI after login", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  await expect(page.locator("header img[alt='Icecap']")).toBeVisible()
  await expect(page.getByTestId("scrape-btn")).toBeVisible()
})

test("price input triggers metric recalculation", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Enter price
  const priceInput = page.locator("input[type='number']").first()
  await priceInput.fill("500000")
  await priceInput.press("Tab")

  // The blue result card should show metrics
  await expect(page.getByTestId("result-card")).toBeVisible()
})

test("rental/flip mode toggle works", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Enter price to show metrics/inputs
  await page.locator("input[type='number']").first().fill("500000")

  // Should start in rental mode
  const flipBtn = page.getByRole("button", { name: "Flip" })
  await flipBtn.click()

  // In flip mode, should show ARV field instead of rent
  await expect(page.getByText("ARV")).toBeVisible()
  await expect(page.getByText("70% Rule MAO")).toBeVisible()
})

test("assumptions sliders update display values", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Down payment slider is the 2nd one
  const slider = page.locator("input[type='range']").nth(1)
  await slider.fill("30")
  await expect(page.getByText("30%")).toBeVisible()
})

test("BRRRR mode shows extended metrics", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Enter price to show metrics
  await page.locator("input[type='number']").first().fill("500000")

  const brrrrBtn = page.getByRole("button", { name: "BRRRR" })
  await brrrrBtn.click()

  await expect(page.locator("h3").getByText("BRRRR Metrics")).toBeVisible()
})

test("STR mode shows STR specific assumptions and metrics", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Enter price to show metrics/inputs
  await page.locator("input[type='number']").first().fill("400000")

  // Toggle to STR
  const strBtn = page.getByRole("button", { name: "STR" })
  await strBtn.click()

  // Should show STR specific assumptions
  await expect(page.getByText("STR Assumptions")).toBeVisible()
  await expect(page.getByText("ADR")).toBeVisible()
  await expect(page.getByText("Occupancy Rate")).toBeVisible()

  // Should show STR Metrics
  await expect(page.locator("h3").getByText("STR Metrics")).toBeVisible()
  await expect(page.getByText("RevPAR")).toBeVisible()
})

test("Both mode shows comparison card", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Enter price to show metrics/inputs
  await page.locator("input[type='number']").first().fill("400000")

  // Toggle to Both
  const bothBtn = page.getByRole("button", { name: "Both" })
  await bothBtn.click()

  // Should show Strategy Comparison card
  await expect(page.getByText("Strategy Comparison")).toBeVisible()
  await expect(page.getByText("Breakeven Analysis")).toBeVisible()
})
