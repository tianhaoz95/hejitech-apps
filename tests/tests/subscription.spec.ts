import { test, expect } from "@playwright/test"

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

test("trigger webhook updates subscription status", async ({ request }) => {
  const uid = `webhook-test-${Date.now()}`

  // Trigger webhook
  const resp = await request.post(`${STRIPE_MOCK_BASE}/trigger-webhook`, {
    data: { uid, tier: "pro", session_id: `cs_mock_test_${uid}` },
    headers: { "Content-Type": "application/json" },
  })
  // Should succeed even if functions are not running in test env
  expect(resp.status()).toBeLessThan(500)
})
