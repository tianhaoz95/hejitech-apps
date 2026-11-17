import { test as base, chromium, type BrowserContext, expect } from "@playwright/test"
import path from "path"
import fs from "fs"
import { createTestUser, setSubscription, clearEmulatorData } from "../fixtures/firebase-helpers"

const TEST_EMAIL = "hi@icecap.com"
const TEST_PASSWORD = "Password123!"
let testUid = ""

const SCREENSHOT_DIR = path.join(__dirname, "../../reports/screenshots")

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

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
        "--force-device-scale-factor=2",
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

test("Screenshot 1: Login Screen", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`)
  await expect(page.getByText("Welcome to Icecap")).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/extension_login.png` })
})

test("Screenshot 2: Rental Analysis", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)
  
  // Fill inputs (Price first to show the others)
  const inputs = page.locator("input[type='number']")
  await inputs.first().fill("450000")
  await inputs.nth(1).fill("3200")
  await page.keyboard.press("Tab")
  
  await expect(page.getByTestId("result-card")).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/extension_rental_analysis.png` })
})

test("Screenshot 3: Flip Analysis", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)
  
  // Price first
  await page.locator("input[type='number']").first().fill("450000")
  
  await page.getByRole("button", { name: "Flip" }).click()
  
  const inputs = page.locator("input[type='number']")
  // Now fill ARV (nth(1) is ARV in flip mode)
  await page.getByPlaceholder("0").nth(1).fill("650000") 
  await page.keyboard.press("Tab")
  
  await expect(page.getByText("70% Rule MAO")).toBeVisible()
  await page.screenshot({ path: `${SCREENSHOT_DIR}/extension_flip_analysis.png` })
})

test("Screenshot 4: AI Chat", async ({ page, extensionId }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await signInExtension(page, extensionId)
  
  // Set a price so questions are enabled
  await page.locator("input[type='number']").first().fill("450000")
  
  // Switch to AI tab
  await page.getByRole("button", { name: "AI" }).click()
  
  // Wait for the empty state or click a suggestion
  await expect(page.getByText("AI Property Assistant")).toBeVisible()
  
  // Click a suggestion to show some interaction
  await page.getByRole("button", { name: "Is this a good deal?" }).click()
  
  // We don't necessarily need to wait for a real reply if the local model is slow/unavailable in CI,
  // but showing the user question is already good.
  await expect(page.getByText("Is this a good deal?")).toBeVisible()
  
  await page.screenshot({ path: `${SCREENSHOT_DIR}/extension_ai_chat.png` })
})
