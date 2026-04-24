import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"
import { createTestUser, setSubscription, clearEmulatorData } from "../fixtures/firebase-helpers"

const TEST_EMAIL = `golden-${Date.now()}@icecap-test.com`
const TEST_PASSWORD = "GoldenPath123!"
let testUid = ""

// Custom fixture
const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use) => {
    const extensionPath = path.join(__dirname, "../../apps/extension/build/chrome-mv3-prod")
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
  const resultCard = page.getByTestId("result-card")
  await expect(resultCard).toBeVisible()
  await expect(page.getByText("Monthly Cash Flow")).toBeVisible()
  await expect(page.getByText("Cap Rate")).toBeVisible()
})

test("golden path: Full sync flow (Extension -> Save -> Hub)", async ({ page, extensionId }) => {
  const address = `Test Property ${Date.now()}`

  // 1. Log in to the extension sidepanel
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await page.evaluate(async ({ email, password }) => {
    const auth = (window as any).auth
    const signIn = (window as any).signInWithEmailAndPassword
    if (!auth || !signIn) throw new Error("Firebase auth or signIn function not found on window")
    await signIn(auth, email, password)
  }, { email: TEST_EMAIL, password: TEST_PASSWORD })

  // Wait for user display
  await expect(page.getByText(TEST_EMAIL)).toBeVisible()

  // 2. Mock some property data
  await page.evaluate(({ addr }) => {
    const store = (window as any).store
    if (!store) throw new Error("Store not found on window")
    store.loadFromScrape({
      address: addr,
      price: 500000,
      taxes: 5000,
      hoa: 250,
      url: "https://www.redfin.com/example",
      description: "A nice test property",
    })
  }, { addr: address })

  // Verify UI updated
  await expect(page.getByText(address)).toBeVisible()
  
  // 3. Click Save
  const saveBtn = page.getByTitle("Save")
  await saveBtn.click()

  // Wait for saved state (green color or status)
  await expect(saveBtn).toHaveClass(/text-green-600/)

  // 4. Verify in Hub
  await page.goto("http://localhost:5173/portfolio")
  // Need to be logged in to Hub too
  await page.evaluate(async ({ email, password }) => {
    const auth = (window as any).auth
    const signIn = (window as any).signInWithEmailAndPassword
    if (!auth || !signIn) throw new Error("Firebase auth or signIn function not found on Hub window")
    await signIn(auth, email, password)
  }, { email: TEST_EMAIL, password: TEST_PASSWORD })

  await expect(page.getByText(address)).toBeVisible()
})
