import { test, expect } from "@playwright/test"
import { getSubscription } from "../fixtures/firebase-helpers"

test.describe("Stripe Subscription Flow", () => {
  test("full subscription lifecycle via simulated webhooks", async ({ page, request }) => {
    const FUNCTIONS_BASE = "http://localhost:5001/demo-icecap/us-central1"

    // 1. Capture the UID from console logs
    let uid: string | null = null
    page.on("console", msg => {
      const text = msg.text()
      if (text.includes("[Hub] Auth UID:")) {
        uid = text.split("Auth UID: ")[1].split(",")[0].trim()
      }
    })

    // 2. Login to Hub
    await page.goto("/login")
    await page.getByTestId("google-signin-btn").click()
    await expect(page).toHaveURL("/", { timeout: 10000 })
    
    // Wait for UID to be captured
    for (let i = 0; i < 50; i++) {
      if (uid) break
      await new Promise(r => setTimeout(r, 100))
    }
    expect(uid).not.toBeNull()
    console.log(`Logged in as UID: ${uid}`)

    // 3. Simulate Pro subscription completion
    console.log(`Simulating Pro subscription for UID: ${uid}`)
    await request.post(`${FUNCTIONS_BASE}/stripeWebhook`, {
      data: {
        type: "checkout.session.completed",
        data: {
          object: {
            id: `cs_test_${Date.now()}`,
            customer: `cus_${uid}`,
            subscription: `sub_${Date.now()}`,
            metadata: { uid, tier: "pro" },
            status: "complete"
          }
        }
      },
      headers: { "stripe-signature": "t=mock,v1=mock" }
    })

    // 4. Verify Billing status in Hub
    await page.goto("/billing")
    await expect(page.getByText(/Pro Plan/i)).toBeVisible({ timeout: 10000 })

    // 5. Upgrade to Pro Max
    console.log(`Simulating Pro Max upgrade for UID: ${uid}`)
    await request.post(`${FUNCTIONS_BASE}/stripeWebhook`, {
      data: {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: `sub_${Date.now()}`,
            customer: `cus_${uid}`,
            status: "active",
            metadata: { uid, tier: "pro_max" },
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600
          }
        }
      },
      headers: { "stripe-signature": "t=mock,v1=mock" }
    })
    
    await page.reload()
    await expect(page.getByRole("heading", { name: /Pro Max Plan/i })).toBeVisible({ timeout: 10000 })

    // 6. Downgrade to Pro
    console.log(`Simulating Pro downgrade for UID: ${uid}`)
    await request.post(`${FUNCTIONS_BASE}/stripeWebhook`, {
      data: {
        type: "customer.subscription.updated",
        data: {
          object: {
            id: `sub_${Date.now()}`,
            customer: `cus_${uid}`,
            status: "active",
            metadata: { uid, tier: "pro" },
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600
          }
        }
      },
      headers: { "stripe-signature": "t=mock,v1=mock" }
    })
    
    await page.reload()
    await expect(page.getByText(/Pro Plan/i)).toBeVisible({ timeout: 10000 })
  })
})
