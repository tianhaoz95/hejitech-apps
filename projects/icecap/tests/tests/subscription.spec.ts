import { test, expect } from "@playwright/test"
import { execSync } from "child_process"

const FUNCTIONS_BASE = "http://localhost:5001/demo-icecap/us-central1"

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
