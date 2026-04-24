import { test, expect } from "@playwright/test"
import { createTestUser, setSubscription, clearEmulatorData } from "../fixtures/firebase-helpers"

const TEST_EMAIL = `hub-test-${Date.now()}@icecap-test.com`
const TEST_PASSWORD = "TestPass123!"

test.beforeAll(async () => {
  // Create a test user with an active subscription
  const uid = await createTestUser(TEST_EMAIL, TEST_PASSWORD)
  await setSubscription(uid, "active", "pro")
})

test.afterAll(async () => {
  await clearEmulatorData()
})

test("hub login page renders correctly", async ({ page }) => {
  await page.goto("/login")
  await expect(page.locator("h1")).toContainText("Icecap Hub")
  await expect(page.getByTestId("google-signin-btn")).toBeVisible()
})

test("unauthenticated visit to / redirects to login", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)
})

test("subscribe page shows both plans", async ({ page }) => {
  await page.goto("/subscribe")
  await expect(page.getByTestId("subscribe-pro")).toBeVisible()
  await expect(page.getByTestId("subscribe-pro_max")).toBeVisible()
  await expect(page.getByText("$19")).toBeVisible()
  await expect(page.getByText("$49")).toBeVisible()
  await expect(page.getByText("30-day free trial")).toBeVisible()
})

test("subscribe success page shows confirmation", async ({ page }) => {
  await page.goto("/subscribe/success")
  await expect(page.getByText("You're all set!")).toBeVisible()
  await expect(page.getByTestId("go-to-dashboard")).toBeVisible()
})

test("subscribe cancel page renders", async ({ page }) => {
  await page.goto("/subscribe/cancel")
  await expect(page.getByText("Checkout cancelled")).toBeVisible()
})
