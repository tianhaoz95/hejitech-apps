import * as admin from "firebase-admin"
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https"
import { logger } from "firebase-functions/v2"
import Stripe from "stripe"

admin.initializeApp()
const db = admin.firestore()

// ─── Stripe client ─────────────────────────────────────────────────────────
// In emulator mode we point at stripe-mock (localhost:12111)
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true"
const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "sk_test_mock"
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-02-24.acacia",
  ...(isEmulator
    ? {
        host: "localhost",
        port: 12111,
        protocol: "http",
      }
    : {}),
})

const AI_QUOTA_PRO = 50
const AI_QUOTA_PRO_MAX = Infinity

// ─── getRentEstimate ───────────────────────────────────────────────────────
export const getRentEstimate = onCall({ cors: true }, async (request) => {
  const { price, address, bedrooms, sqft } = request.data ?? {}
  if (!price || price <= 0) {
    throw new HttpsError("invalid-argument", "price is required")
  }

  // Try RentCast API in production (stubbed for emulator phase)
  if (!isEmulator && process.env.RENTCAST_API_KEY) {
    try {
      const params = new URLSearchParams()
      if (address) params.append("address", address)
      if (bedrooms) params.append("bedrooms", String(bedrooms))
      if (sqft) params.append("squareFootage", String(sqft))

      const resp = await fetch(`https://api.rentcast.io/v1/avm/rent/long-term?${params}`, {
        headers: { "X-Api-Key": process.env.RENTCAST_API_KEY },
      })
      if (resp.ok) {
        const data = (await resp.json()) as { rent?: number }
        if (data.rent) {
          return { estimate: data.rent, source: "rentcast", confidence: "high" }
        }
      }
    } catch (e) {
      logger.warn("RentCast API failed, falling back to heuristic", e)
    }
  }

  // Heuristic: ~0.7% of property price for base estimate
  const estimate = Math.round(price * 0.007)
  return { estimate, source: "heuristic", confidence: "low" }
})

// ─── validatePromoCode ─────────────────────────────────────────────────────
export const validatePromoCode = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { code } = request.data ?? {}
  if (!code) throw new HttpsError("invalid-argument", "code is required")

  const snap = await db
    .collection("promo_codes")
    .where("code", "==", code.trim().toUpperCase())
    .where("isActive", "==", true)
    .limit(1)
    .get()

  if (snap.empty) {
    return { valid: false }
  }

  const doc = snap.docs[0]
  const promo = doc.data()

  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
    return { valid: false }
  }

  return {
    valid: true,
    type: promo.type,
    stripeCouponId: promo.stripeCouponId ?? null,
    discountDescription: promo.type === "internal_free" ? "$0/month forever" : "Discount applied",
  }
})

// ─── createCheckoutSession ─────────────────────────────────────────────────
export const createCheckoutSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { tier, promoCode, successUrl, cancelUrl, lookupKey } = request.data ?? {}
  
  let priceId: string
  
  if (lookupKey) {
    const prices = await stripe.prices.list({
      lookup_keys: [lookupKey],
      expand: ["data.product"],
    })
    if (prices.data.length === 0) {
      throw new HttpsError("not-found", "Price not found for lookup key")
    }
    priceId = prices.data[0].id
  } else {
    if (!tier) throw new HttpsError("invalid-argument", "tier or lookupKey is required")
    priceId =
      tier === "pro_max"
        ? (process.env.STRIPE_PRICE_ID_PRO_MAX ?? "price_pro_max_mock")
        : (process.env.STRIPE_PRICE_ID_PRO ?? "price_pro_mock")
  }

  if (!successUrl || !cancelUrl) {
    throw new HttpsError("invalid-argument", "successUrl and cancelUrl are required")
  }

  // Look up or create Stripe customer
  let customerId: string | undefined
  const subSnap = await db.collection("subscriptions").doc(request.auth.uid).get()
  if (subSnap.exists) {
    customerId = subSnap.data()?.stripeCustomerId
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    billing_address_collection: "auto",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl.includes("?") 
      ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` 
      : `${successUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl.includes("?") ? `${cancelUrl}&canceled=true` : `${cancelUrl}?canceled=true`,
    subscription_data: {
      trial_period_days: tier === "pro" ? 30 : undefined,
    },
    metadata: {
      uid: request.auth.uid,
      tier: tier ?? "custom",
    },
  }

  if (customerId) sessionParams.customer = customerId
  else sessionParams.customer_email = request.auth.token.email ?? undefined

  if (promoCode) {
    const promoSnap = await db
      .collection("promo_codes")
      .where("code", "==", promoCode.trim().toUpperCase())
      .where("isActive", "==", true)
      .limit(1)
      .get()

    if (!promoSnap.empty) {
      const promo = promoSnap.docs[0].data()
      if (promo.type === "internal_free") {
        sessionParams.line_items = [
          { price: process.env.STRIPE_PRICE_ID_FREE ?? "price_free_mock", quantity: 1 },
        ]
        delete sessionParams.subscription_data?.trial_period_days
      } else if (promo.stripeCouponId) {
        sessionParams.discounts = [{ coupon: promo.stripeCouponId }]
      }
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)
  return { sessionId: session.id, url: session.url }
})

// ─── createPortalSession ───────────────────────────────────────────────────
export const createPortalSession = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { returnUrl, sessionId } = request.data ?? {}
  if (!returnUrl) {
    throw new HttpsError("invalid-argument", "returnUrl is required")
  }

  let customerId: string | undefined

  if (sessionId) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)
    customerId = typeof checkoutSession.customer === "string" ? checkoutSession.customer : checkoutSession.customer?.id
  } else {
    const subSnap = await db.collection("subscriptions").doc(request.auth.uid).get()
    if (subSnap.exists) {
      customerId = subSnap.data()?.stripeCustomerId
    }
  }

  if (!customerId) {
    throw new HttpsError("not-found", "No Stripe customer found for this user")
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return { url: session.url }
})

// ─── stripeWebhook ─────────────────────────────────────────────────────────
export const stripeWebhook = onRequest({ cors: false }, async (req, res) => {
  logger.info("Stripe Webhook received", { method: req.method })
  
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed")
    return
  }

  const sig = req.headers["stripe-signature"]
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_mock"

  let event: Stripe.Event
  try {
    // req.rawBody is provided by Firebase Functions
    event = stripe.webhooks.constructEvent(req.rawBody, sig as string, webhookSecret)
  } catch (e) {
    logger.error("Webhook signature verification failed", e)
    // In emulator mode, skip signature check if secret is not set correctly
    if (isEmulator) {
      event = req.body as Stripe.Event
    } else {
      res.status(400).send(`Webhook Error: ${(e as Error).message}`)
      return
    }
  }

  try {
    await handleStripeEvent(event)
    res.json({ received: true })
  } catch (e) {
    logger.error("Error handling Stripe event", e)
    res.status(500).send("Internal Error")
  }
})

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  logger.info(`Processing Stripe event: ${event.type}`)
  
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const uid = session.metadata?.uid
      const tier = session.metadata?.tier as "pro" | "pro_max" | undefined
      
      logger.info(`Checkout completed for UID: ${uid}, Tier: ${tier}`)
      
      if (!uid) {
        logger.error("Missing UID in session metadata", session.metadata)
        break
      }

      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id

      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id

      // Retrieve subscription from Stripe for full details
      let trialEnd: number | null = null
      let currentPeriodEnd: number | null = null
      let status: string = "active"

      if (subId) {
        try {
          const sub = await stripe.subscriptions.retrieve(subId)
          trialEnd = sub.trial_end
          currentPeriodEnd = sub.current_period_end
          status = sub.status
        } catch {
          // In mock mode subscription may not exist; use defaults
          status = "active"
        }
      }

      await db
        .collection("subscriptions")
        .doc(uid)
        .set(
          {
            uid,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subId,
            tier: tier ?? "pro",
            status,
            currentPeriodEnd,
            aiUsageCurrentMonth: 0,
            aiQuotaLimit: tier === "pro_max" ? AI_QUOTA_PRO_MAX : AI_QUOTA_PRO,
            trialEnd,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
      break
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id
      const status = sub.status

      logger.info(`Subscription ${event.type}: ${sub.id}, Status: ${status}`)

      // Find the user by Stripe customer ID
      const snap = await db
        .collection("subscriptions")
        .where("stripeCustomerId", "==", customerId)
        .limit(1)
        .get()

      if (snap.empty) {
        logger.warn("No subscription found for customer", customerId)
        break
      }

      const docRef = snap.docs[0].ref
      const existingData = snap.docs[0].data()
      const tier = (sub.metadata?.tier as "pro" | "pro_max") ?? existingData.tier ?? "pro"

      await docRef.set(
        {
          tier,
          status,
          currentPeriodEnd: sub.current_period_end,
          trialEnd: sub.trial_end,
          aiQuotaLimit: tier === "pro_max" ? AI_QUOTA_PRO_MAX : AI_QUOTA_PRO,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
      break
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription
      logger.info(`Subscription trial will end soon: ${sub.id}`)
      // Here you could send an email notification to the user
      break
    }

    default:
      logger.info(`Unhandled event type: ${event.type}`)
  }
}

    default:
      logger.info(`Unhandled event type: ${event.type}`)
  }
}

// ─── analyzeProperty (AI stub for emulator phase) ─────────────────────────
export const analyzeProperty = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  // Check subscription and quota
  const subSnap = await db.collection("subscriptions").doc(request.auth.uid).get()
  if (!subSnap.exists) {
    throw new HttpsError("permission-denied", "Active subscription required")
  }
  const sub = subSnap.data()!
  if (sub.status !== "active" && sub.status !== "trialling") {
    throw new HttpsError("permission-denied", "Active subscription required")
  }
  if (sub.tier !== "pro_max" && sub.aiUsageCurrentMonth >= sub.aiQuotaLimit) {
    throw new HttpsError("resource-exhausted", "Monthly AI quota reached")
  }

  // Increment usage counter
  await subSnap.ref.update({
    aiUsageCurrentMonth: admin.firestore.FieldValue.increment(1),
    updatedAt: Date.now(),
  })

  // In emulator mode: return a stub response
  if (isEmulator) {
    return {
      summary: "This property shows potential for a solid cash-flow investment. The listing mentions recent updates to the kitchen and bathrooms, which reduces near-term rehab needs.",
      redFlags: [
        "Roof is noted as '15 years old' — may need replacement within 5 years (~$10k-$20k).",
        "Listed as 'as-is' — seller may know of undisclosed issues.",
        "Location near flood zone boundary — verify FEMA maps and insurance costs.",
      ],
      rehabEstimate: "low",
      recommendation: "Run comps in the immediate neighborhood and verify rental rates on Zillow. Consider an inspection contingency.",
    }
  }

  // Production: call Vertex AI (implemented in production phase)
  throw new HttpsError("unimplemented", "AI analysis not available in this environment")
})

// ─── manageSubscription (Admin only) ──────────────────────────────────────
export const manageSubscription = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")
  if (!request.auth.token.admin) throw new HttpsError("permission-denied", "Admin only")

  const { uid, action, value } = request.data ?? {}
  if (!uid || !action) throw new HttpsError("invalid-argument", "uid and action required")

  const ref = db.collection("subscriptions").doc(uid)

  switch (action) {
    case "set_status":
      await ref.set({ status: value, updatedAt: Date.now() }, { merge: true })
      break
    case "set_quota":
      await ref.set({ aiQuotaLimit: value, updatedAt: Date.now() }, { merge: true })
      break
    case "reset_usage":
      await ref.set({ aiUsageCurrentMonth: 0, updatedAt: Date.now() }, { merge: true })
      break
    case "set_tier":
      await ref.set(
        {
          tier: value,
          aiQuotaLimit: value === "pro_max" ? AI_QUOTA_PRO_MAX : AI_QUOTA_PRO,
          updatedAt: Date.now(),
        },
        { merge: true }
      )
      break
    default:
      throw new HttpsError("invalid-argument", `Unknown action: ${action}`)
  }

  return { success: true }
})

// ─── debugCreateSubscription (Dev only) ───────────────────────────────────
export const debugCreateSubscription = onCall({ cors: true }, async (request) => {
  if (!isEmulator) {
    throw new HttpsError("permission-denied", "This function is only available in emulator mode")
  }
  if (!request.auth) throw new HttpsError("unauthenticated", "Login required")

  const { tier = "pro_max" } = request.data ?? {}
  const uid = request.auth.uid

  await db.collection("subscriptions").doc(uid).set({
    uid,
    tier,
    status: "active",
    stripeCustomerId: "cus_debug",
    stripeSubscriptionId: "sub_debug",
    aiUsageCurrentMonth: 0,
    aiQuotaLimit: tier === "pro_max" ? AI_QUOTA_PRO_MAX : AI_QUOTA_PRO,
    updatedAt: Date.now(),
    is_debug: true,
  }, { merge: true })

  return { success: true, uid }
})
