import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"
import { createTestUser, setSubscription, clearEmulatorData } from "../fixtures/firebase-helpers"

const TEST_EMAIL = `ext-test-${Date.now()}@icecap-test.com`
const TEST_PASSWORD = "TestPass123!"
let testUid = ""

// Custom fixture for extension testing
export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
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
  await page.evaluate(async ({ email, password }) => {
    const auth = (window as any).auth
    const signIn = (window as any).signInWithEmailAndPassword
    if (!auth || !signIn) throw new Error("Firebase auth or signIn function not found on window")
    await signIn(auth, email, password)
  }, { email: TEST_EMAIL, password: TEST_PASSWORD })
  await expect(page.getByText(TEST_EMAIL)).toBeVisible()
}

test("shows login screen when unauthenticated", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)

  await expect(page.getByText("Welcome to Icecap")).toBeVisible()
  await expect(page.getByText("Sign in with Google")).toBeVisible()
})

test("side panel loads with calculator UI after login", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  await expect(page.locator("header span.text-lg.font-bold")).toContainText("Icecap")
  await expect(page.getByTestId("scrape-btn")).toBeVisible()
})

test("price input triggers metric recalculation", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  // Enter price
  const priceInput = page.locator("input[type='number']").first()
  await priceInput.fill("500000")
  await priceInput.press("Tab")

  // Enter rent
  const rentInput = page.locator("input[type='number']").nth(1)
  await rentInput.fill("3000")
  await rentInput.press("Tab")

  // The blue result card should show metrics
  await expect(page.getByTestId("result-card")).toBeVisible()
})

test("rental/flip mode toggle works", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

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

  // Down payment slider
  const slider = page.locator("input[type='range']").first()
  await slider.fill("30")
  await expect(page.getByText("30%")).toBeVisible()
})

test("BRRRR mode shows extended metrics", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)

  const brrrrBtn = page.getByRole("button", { name: "BRRRR" })
  await brrrrBtn.click()

  await expect(page.locator("h3").getByText("BRRRR Metrics")).toBeVisible()
})
