import { test, expect } from "@playwright/test"
import { createTestUser, clearEmulatorData } from "../fixtures/firebase-helpers"

const TEST_EMAIL = `sub-flow-${Date.now()}@icecap-test.com`
const TEST_PASSWORD = "Password123!"

test.describe("Stripe Subscription Flow", () => {
  test.beforeAll(async () => {
    // We don't clear all data because other tests might be running, 
    // but for this specific test we need a fresh user.
    await createTestUser(TEST_EMAIL, TEST_PASSWORD)
  })

  test.afterAll(async () => {
    // Cleanup if needed
  })

  test("full subscription lifecycle: trial -> upgrade -> downgrade", async ({ page }) => {
    // 1. Login to Hub
    await page.goto("/login")
    
    // Click Google Sign-in (which is mocked in emulator mode)
    await page.getByTestId("google-signin-btn").click()
    
    // Verify we are on dashboard
    await expect(page).toHaveURL("/")
    await expect(page.getByText(/dashboard/i)).toBeVisible()

    // 2. Go to Subscribe page
    await page.goto("/subscribe")
    await expect(page.getByText(/Choose your plan/i)).toBeVisible()

    // 3. Start Pro subscription (Free Trial)
    await page.getByTestId("subscribe-pro").click()
    
    // Should redirect to Stripe (Mock in this case for automation)
    // We wait for the mock checkout or real checkout
    // For E2E automation, we expect the mock checkout if we are in emulator mode
    await page.waitForURL(/localhost:12111\/mock-checkout|checkout.stripe.com/)
    
    if (page.url().includes("localhost:12111")) {
      // We are in mock mode, click Pay
      await expect(page.getByText("Mock Stripe Checkout")).toBeVisible()
      await page.getByRole("button", { name: /Pay/i }).click()
    } else {
      // In a real environment we can't easily automate this
      console.warn("Landed on real Stripe Checkout. Manual intervention needed or test will fail.")
      test.skip(true, "Real Stripe Checkout cannot be automated easily")
      return
    }

    // 4. Verify Success page
    await page.waitForURL(/\/subscribe\/success/)
    await expect(page.getByText(/You're all set/i)).toBeVisible()
    
    // Verify Manage Billing button is present
    await expect(page.getByRole("button", { name: /Manage Billing/i })).toBeVisible()
    
    // Click Go to Dashboard
    await page.getByRole("button", { name: /Go to Dashboard/i }).click()
    await expect(page).toHaveURL("/")

    // 5. Verify Billing status in Hub
    await page.goto("/billing")
    await expect(page.getByText(/Pro Plan/i)).toBeVisible()
    await expect(page.getByRole("main").getByText(/active|trialling/i)).toBeVisible()

    // 6. Upgrade to Pro Max
    await page.getByRole("button", { name: /Upgrade Now|Change Plan/i }).click()
    await page.waitForURL("/subscribe")
    
    await page.getByTestId("subscribe-pro_max").click()
    
    // Again, Mock Checkout
    await page.waitForURL(/localhost:12111\/mock-checkout/)
    await page.getByRole("button", { name: /Pay/i }).click()
    
    // Success page
    await page.waitForURL(/\/subscribe\/success/)
    await page.getByRole("button", { name: /Go to Dashboard/i }).click()
    
    // 7. Verify Pro Max status
    await page.goto("/billing")
    await expect(page.getByRole("heading", { name: /Pro Max Plan/i })).toBeVisible()

    // 8. Downgrade to Pro
    await page.getByRole("button", { name: /Change Plan/i }).click()
    await page.waitForURL("/subscribe")
    
    await page.getByTestId("subscribe-pro").click()
    
    // Mock Checkout
    await page.waitForURL(/localhost:12111\/mock-checkout/)
    await page.getByRole("button", { name: /Pay/i }).click()
    
    // Success page
    await page.waitForURL(/\/subscribe\/success/)
    await page.getByRole("button", { name: /Go to Dashboard/i }).click()
    
    // 9. Final verification in Billing
    await page.goto("/billing")
    await expect(page.getByText(/Pro Plan/i)).toBeVisible()
  })
})
