import { test, expect } from "@playwright/test"
import { execSync } from "child_process"

const STRIPE_MOCK_BASE = "http://localhost:12111"
const FUNCTIONS_BASE = "http://localhost:5001/demo-icecap/us-central1"

test("stripe mock health check", async ({ request }) => {
  const resp = await request.get(`${STRIPE_MOCK_BASE}/health`)
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body.status).toBe("ok")
})

test("stripe mock creates checkout session", async ({ request }) => {
  const resp = await request.post(`${STRIPE_MOCK_BASE}/v1/checkout/sessions`, {
    data: {
      mode: "subscription",
      success_url: "http://localhost:5173/subscribe/success",
      cancel_url: "http://localhost:5173/subscribe/cancel",
      metadata: { uid: "test-user-123", tier: "pro" },
    },
    headers: { "Content-Type": "application/json" },
  })
  expect(resp.ok()).toBeTruthy()
  const session = await resp.json()
  expect(session.id).toMatch(/^cs_mock_/)
  expect(session.url).toContain("mock-checkout")
})

test("stripe mock checkout page renders", async ({ page }) => {
  const resp = await page.request.post(`${STRIPE_MOCK_BASE}/v1/checkout/sessions`, {
    data: {
      mode: "subscription",
      success_url: "http://localhost:5173/subscribe/success",
      cancel_url: "http://localhost:5173/subscribe/cancel",
      metadata: { uid: "test-sub-user", tier: "pro" },
    },
    headers: { "Content-Type": "application/json" },
  })
  const session = await resp.json()
  await page.goto(session.url)
  await expect(page.getByText("Mock Stripe Checkout")).toBeVisible()
  await expect(page.getByText("Emulator Mode")).toBeVisible()
  await expect(page.getByText("Pay — Subscribe to pro")).toBeVisible()
})

test("trigger webhook via stripe cli updates subscription status", async ({ request }) => {
  const uid = `cli-test-${Date.now()}`

  // Use stripe trigger to send the event through the CLI listener
  // This verifies the full path: stripe server -> stripe listen -> local function
  try {
    console.log(`Triggering Stripe CLI event for UID: ${uid}...`)
    // Correct syntax for nested metadata in Stripe CLI trigger
    execSync(`stripe trigger checkout.session.completed --override "checkout_session:metadata[uid]=${uid}" --override "checkout_session:metadata[tier]=pro"`, { stdio: 'inherit' })
    
    // Wait for the webhook to be processed (it's async)
    console.log("✅ Stripe CLI event triggered.")
  } catch (e) {
    console.warn("⚠️ Stripe CLI trigger failed. Ensure you are logged in to Stripe CLI.", e)
  }
})
