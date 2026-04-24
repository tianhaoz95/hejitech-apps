import express from "express"
import cors from "cors"
import { randomUUID } from "crypto"
import http from "http"

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = 12111
const FUNCTIONS_URL = "http://localhost:5001/demo-icecap/us-central1/stripeWebhook"

// In-memory subscription store
const subscriptions = new Map<string, MockSubscription>()

interface MockSubscription {
  id: string
  status: string
  customer: string
  current_period_end: number
  trial_end: number | null
  metadata: Record<string, string>
}

// ─── Stripe-compatible routes ──────────────────────────────────────────────

// POST /v1/checkout/sessions — create a mock checkout session
app.post("/v1/checkout/sessions", (req, res) => {
  const body = req.body
  const sessionId = `cs_mock_${randomUUID().replace(/-/g, "")}`
  const uid = body.metadata?.uid ?? "unknown"
  const tier = body.metadata?.tier ?? "pro"

  // The "checkout" URL points to our mock checkout page
  const checkoutUrl = `http://localhost:${PORT}/mock-checkout?session_id=${sessionId}&uid=${uid}&tier=${tier}&success_url=${encodeURIComponent(body.success_url ?? "")}&cancel_url=${encodeURIComponent(body.cancel_url ?? "")}`

  res.json({
    id: sessionId,
    object: "checkout.session",
    url: checkoutUrl,
    status: "open",
    metadata: { uid, tier },
  })
})

// GET /v1/checkout/sessions/:id — retrieve session
app.get("/v1/checkout/sessions/:id", (req, res) => {
  res.json({
    id: req.params.id,
    object: "checkout.session",
    status: "complete",
    payment_status: "paid",
  })
})

// GET /v1/subscriptions/:id — retrieve subscription
app.get("/v1/subscriptions/:id", (req, res) => {
  const sub = subscriptions.get(req.params.id)
  if (!sub) {
    return res.status(404).json({ error: { message: "No such subscription" } })
  }
  return res.json({ ...sub, object: "subscription" })
})

// POST /v1/subscriptions — create subscription (called internally)
app.post("/v1/subscriptions", (req, res) => {
  const subId = `sub_mock_${randomUUID().replace(/-/g, "").slice(0, 14)}`
  const sub: MockSubscription = {
    id: subId,
    status: req.body.trial_period_days ? "trialling" : "active",
    customer: req.body.customer ?? `cus_mock_${randomUUID().slice(0, 10)}`,
    current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    trial_end: req.body.trial_period_days
      ? Math.floor(Date.now() / 1000) + req.body.trial_period_days * 24 * 3600
      : null,
    metadata: req.body.metadata ?? {},
  }
  subscriptions.set(subId, sub)
  res.json({ ...sub, object: "subscription" })
})

// ─── Mock checkout page ────────────────────────────────────────────────────

app.get("/mock-checkout", (req, res) => {
  const { session_id, uid, tier, success_url, cancel_url } = req.query
  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Icecap Stripe Mock Checkout</title>
  <style>
    * { box-sizing: border-box; font-family: Inter, sans-serif; }
    body { background: #0a2540; min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; }
    .card { background: white; padding: 2rem; border-radius: 16px; width: 420px; }
    h1 { font-size: 1.4rem; font-weight: 900; color: #1a1a2e; margin: 0 0 0.5rem; }
    .badge { display: inline-block; background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; margin-bottom: 1.5rem; text-transform: uppercase; }
    label { display: block; font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 4px; }
    input { width: 100%; padding: 10px 14px; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 14px; margin-bottom: 12px; outline: none; }
    input:focus { border-color: #2563eb; }
    .hint { font-size: 11px; color: #9ca3af; margin-bottom: 1.5rem; }
    .btn-pay { width: 100%; padding: 14px; background: #2563eb; color: white; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .btn-pay:hover { background: #1d4ed8; }
    .btn-cancel { display: block; text-align: center; margin-top: 12px; color: #9ca3af; font-size: 13px; cursor: pointer; text-decoration: none; }
    .btn-cancel:hover { color: #6b7280; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Mock Stripe Checkout</h1>
    <div class="badge">Emulator Mode</div>
    <p style="color:#374151;font-size:14px;margin-bottom:1.5rem">
      Plan: <strong>${tier}</strong> &middot; User: <code style="font-size:12px">${uid}</code>
    </p>
    <label>Card Number</label>
    <input type="text" value="4242 4242 4242 4242" readonly />
    <label>Expiry</label>
    <input type="text" value="12/28" readonly />
    <label>CVC</label>
    <input type="text" value="123" readonly />
    <p class="hint">Test card pre-filled. Click Pay to simulate a successful checkout.</p>
    <button class="btn-pay" onclick="completePurchase()">Pay — Subscribe to ${tier}</button>
    <a class="btn-cancel" href="${cancel_url}">Cancel</a>
  </div>
  <script>
    async function completePurchase() {
      const btn = document.querySelector('.btn-pay');
      btn.textContent = 'Processing…';
      btn.disabled = true;

      // Trigger webhook to update Firestore
      await fetch('/trigger-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: '${session_id}',
          uid: '${uid}',
          tier: '${tier}'
        })
      });

      // Redirect to success URL
      window.location.href = decodeURIComponent('${success_url}');
    }
  </script>
</body>
</html>`)
})

// ─── Webhook trigger ──────────────────────────────────────────────────────

app.post("/trigger-webhook", async (req, res) => {
  const { uid, tier, session_id } = req.body

  if (!uid || !tier) {
    return res.status(400).json({ error: "uid and tier required" })
  }

  const customerId = `cus_mock_${uid.slice(0, 10)}`
  const subId = `sub_mock_${session_id?.slice(-14) ?? randomUUID().slice(0, 14)}`

  // Create subscription in memory
  const now = Math.floor(Date.now() / 1000)
  const sub: MockSubscription = {
    id: subId,
    status: tier === "pro" ? "trialling" : "active",
    customer: customerId,
    current_period_end: now + 30 * 24 * 3600,
    trial_end: tier === "pro" ? now + 30 * 24 * 3600 : null,
    metadata: { uid, tier },
  }
  subscriptions.set(subId, sub)

  // Fire checkout.session.completed to Cloud Functions
  const webhookPayload = {
    type: "checkout.session.completed",
    data: {
      object: {
        id: session_id ?? `cs_mock_${randomUUID()}`,
        object: "checkout.session",
        customer: customerId,
        subscription: subId,
        metadata: { uid, tier },
        status: "complete",
      },
    },
    livemode: false,
  }

  try {
    await fireWebhook(webhookPayload)
    return res.json({ success: true, subscriptionId: subId })
  } catch (e) {
    console.error("Failed to fire webhook to Cloud Functions:", e)
    // Return success anyway so checkout page can redirect
    return res.json({ success: true, subscriptionId: subId, warning: "Webhook delivery failed" })
  }
})

// Update subscription status
app.post("/update-subscription/:subId", async (req, res) => {
  const { subId } = req.params
  const { status } = req.body

  const sub = subscriptions.get(subId)
  if (!sub) return res.status(404).json({ error: "Subscription not found" })

  sub.status = status
  subscriptions.set(subId, sub)

  const webhookPayload = {
    type: "customer.subscription.updated",
    data: {
      object: {
        ...sub,
        object: "subscription",
      },
    },
    livemode: false,
  }

  try {
    await fireWebhook(webhookPayload)
    return res.json({ success: true })
  } catch (e) {
    return res.json({ success: false, error: (e as Error).message })
  }
})

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", subscriptions: subscriptions.size })
})

// ─── Webhook delivery helper ───────────────────────────────────────────────

function fireWebhook(payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload)
    const url = new URL(FUNCTIONS_URL)

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "stripe-signature": "t=mock,v1=mock_signature",
      },
    }

    const req = http.request(options, (res) => {
      let data = ""
      res.on("data", (chunk) => { data += chunk })
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
        } else {
          reject(new Error(`Webhook returned ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on("error", reject)
    req.write(body)
    req.end()
  })
}

app.listen(PORT, () => {
  console.log(`🎭 Stripe Mock running on http://localhost:${PORT}`)
  console.log(`   Webhook target: ${FUNCTIONS_URL}`)
  console.log(`   Health: http://localhost:${PORT}/health`)
})
