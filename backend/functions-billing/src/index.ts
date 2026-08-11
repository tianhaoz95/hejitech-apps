import { onCall, onRequest, HttpsError } from "firebase-functions/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import * as logger from "firebase-functions/logger";

// Direct Stripe integration, not the "Run Payments with Stripe" Firebase
// Extension — that extension is scheduled to shut down March 31, 2027 with no
// migration path published yet (as of this writing), which is a bad
// foundation for a product that hasn't even launched. This mirrors the
// extension's general shape (a per-user subscription doc kept in sync via
// webhook) without depending on it. See reports/pricing-proposal-v0.html for
// the Pro tier this backs ($9.99/mo or $99/yr).
//
// Its own Firebase Functions codebase (backend/functions-billing/), separate
// from backend/functions/ — deliberately kept free of the genkit dependency
// tree, which pulls in a chain of *optional* transitive deps (winston, an
// older nested @google-cloud/firestore) that npm resolves non-deterministically
// and repeatedly broke `npm ci` on Cloud Build for newly-created functions.
// These billing functions don't use Genkit/AI at all, so there's no reason
// for them to inherit that fragility.
//
// Local dev: export STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET as env vars
// (Genkit-style, see backend/README.md's GOOGLE_GENAI_API_KEY precedent).
// Deployed: firebase functions:secrets:set STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
initializeApp();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

function stripeClient(): Stripe {
  return new Stripe(stripeSecretKey.value());
}

/** users/{uid}/billing/subscription — client-readable, server-write-only (see firestore.rules). */
function subscriptionDoc(uid: string) {
  return getFirestore().collection("users").doc(uid).collection("billing").doc("subscription");
}

/**
 * Maps a Stripe customer back to a Firebase uid without an extra Stripe API
 * call from the webhook — written once, at customer-creation time, in
 * createCheckoutSession below. Admin-only; never read or written by a
 * client (see firestore.rules).
 */
function stripeCustomerDoc(customerId: string) {
  return getFirestore().collection("stripeCustomers").doc(customerId);
}

async function getOrCreateStripeCustomer(uid: string, email: string | undefined): Promise<string> {
  const existing = await subscriptionDoc(uid).get();
  const existingId = existing.data()?.stripeCustomerId as string | undefined;
  if (existingId) return existingId;

  const stripe = stripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { firebaseUID: uid },
  });
  await stripeCustomerDoc(customer.id).set({ uid });
  await subscriptionDoc(uid).set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

/**
 * Callable from the web app only in practice (see CLAUDE.md — subscriptions
 * are sold on web, never via in-app purchase). enforceAppCheck: false for the
 * same reason as deleteAccount in account.ts: web has no App Check provider
 * registered yet, and Firebase Auth (request.auth.uid) is the real
 * authorization boundary here, not App Check.
 */
export const createCheckoutSession = onCall(
  { secrets: [stripeSecretKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before starting checkout.");
    }
    const { priceId, successUrl, cancelUrl } = request.data as {
      priceId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };
    if (!priceId || !successUrl || !cancelUrl) {
      throw new HttpsError("invalid-argument", "priceId, successUrl, and cancelUrl are required.");
    }

    const uid = request.auth.uid;
    const customerId = await getOrCreateStripeCustomer(uid, request.auth.token.email as string | undefined);

    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: uid,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return { url: session.url };
  }
);

/** Lets a Pro subscriber manage or cancel their plan via Stripe's hosted portal. */
export const createPortalLink = onCall(
  { secrets: [stripeSecretKey], enforceAppCheck: false },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in before managing your plan.");
    }
    const { returnUrl } = request.data as { returnUrl?: string };
    if (!returnUrl) {
      throw new HttpsError("invalid-argument", "returnUrl is required.");
    }

    const uid = request.auth.uid;
    const snap = await subscriptionDoc(uid).get();
    const customerId = snap.data()?.stripeCustomerId as string | undefined;
    if (!customerId) {
      throw new HttpsError("failed-precondition", "No billing account yet — start checkout first.");
    }

    const stripe = stripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return { url: portalSession.url };
  }
);

async function syncSubscription(uid: string, subscription: Stripe.Subscription): Promise<void> {
  const price = subscription.items.data[0]?.price;
  await subscriptionDoc(uid).set(
    {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      priceId: price?.id ?? null,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? Timestamp.fromMillis(subscription.items.data[0].current_period_end * 1000)
        : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Shared guard for every admin* function below — the admin/ site's only
 * server-side enforcement (Firestore/Storage rules cover the rest of that
 * site's needs, but Stripe has no rules engine of its own, so a Cloud
 * Function is the only place a coupon-management call can actually be
 * gated). request.auth.token.admin is the custom claim
 * backend/scripts/set-admin-claim.js sets via the Admin SDK — never
 * client-settable, so this can't be spoofed by a signed-in non-admin.
 */
function assertAdmin(request: { auth?: { token?: Record<string, unknown> } | null }): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before managing coupons.");
  }
  if (request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
}

/**
 * Lists promotion codes (the customer-facing redeemable strings, each
 * expanded with its underlying coupon — the actual discount definition) and
 * raw coupons (so a coupon created without a promotion code, e.g. straight
 * from the Stripe Dashboard, still shows up). See admin/src/pages/CouponsPage.tsx.
 */
export const adminListCoupons = onCall({ secrets: [stripeSecretKey], enforceAppCheck: false }, async (request) => {
  assertAdmin(request);
  const stripe = stripeClient();
  const [promotionCodes, coupons] = await Promise.all([
    stripe.promotionCodes.list({ limit: 100, expand: ["data.promotion.coupon"] }),
    stripe.coupons.list({ limit: 100 }),
  ]);
  return { promotionCodes: promotionCodes.data, coupons: coupons.data };
});

/**
 * Creates a Coupon (the discount rule) and a Promotion Code on top of it
 * (the string a host actually types at checkout) in one call — the admin/
 * site never creates a bare coupon, since an admin always wants something
 * redeemable to hand out. `purpose` lands in both objects' metadata (e.g.
 * "personal_testing", "influencer_promo") purely for the admin's own later
 * filtering/audit — Stripe doesn't interpret it.
 */
export const adminCreateCoupon = onCall({ secrets: [stripeSecretKey], enforceAppCheck: false }, async (request) => {
  assertAdmin(request);
  const {
    name,
    percentOff,
    amountOff,
    currency,
    duration,
    durationInMonths,
    maxRedemptions,
    redeemBy,
    code,
    purpose,
  } = request.data as {
    name?: string;
    percentOff?: number;
    amountOff?: number;
    currency?: string;
    duration?: "once" | "repeating" | "forever";
    durationInMonths?: number;
    maxRedemptions?: number;
    redeemBy?: number; // unix seconds
    code?: string;
    purpose?: string;
  };

  if (!duration || !["once", "repeating", "forever"].includes(duration)) {
    throw new HttpsError("invalid-argument", "duration must be one of once/repeating/forever.");
  }
  if (!percentOff && !amountOff) {
    throw new HttpsError("invalid-argument", "Set either percentOff or amountOff.");
  }
  if (percentOff && (percentOff <= 0 || percentOff > 100)) {
    throw new HttpsError("invalid-argument", "percentOff must be between 1 and 100.");
  }
  if (amountOff && !currency) {
    throw new HttpsError("invalid-argument", "currency is required when amountOff is set.");
  }
  if (duration === "repeating" && !durationInMonths) {
    throw new HttpsError("invalid-argument", "durationInMonths is required when duration is repeating.");
  }

  const stripe = stripeClient();
  const metadata = purpose ? { purpose } : undefined;

  const coupon = await stripe.coupons.create({
    name: name || undefined,
    percent_off: percentOff || undefined,
    amount_off: amountOff || undefined,
    currency: amountOff ? currency : undefined,
    duration,
    duration_in_months: duration === "repeating" ? durationInMonths : undefined,
    max_redemptions: maxRedemptions || undefined,
    redeem_by: redeemBy || undefined,
    metadata,
  });

  const promotionCode = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: code || undefined,
    max_redemptions: maxRedemptions || undefined,
    expires_at: redeemBy || undefined,
    metadata,
  });

  return { coupon, promotionCode };
});

/** Deactivates a promotion code — the code stops working at checkout, but the underlying coupon/its history is untouched. */
export const adminDeactivatePromotionCode = onCall(
  { secrets: [stripeSecretKey], enforceAppCheck: false },
  async (request) => {
    assertAdmin(request);
    const { promotionCodeId } = request.data as { promotionCodeId?: string };
    if (!promotionCodeId) {
      throw new HttpsError("invalid-argument", "promotionCodeId is required.");
    }
    const stripe = stripeClient();
    const promotionCode = await stripe.promotionCodes.update(promotionCodeId, { active: false });
    return { promotionCode };
  }
);

/** Deletes a coupon outright — permanently invalidates every promotion code built on it (Stripe's own cascade, not something this function does manually). */
export const adminDeleteCoupon = onCall({ secrets: [stripeSecretKey], enforceAppCheck: false }, async (request) => {
  assertAdmin(request);
  const { couponId } = request.data as { couponId?: string };
  if (!couponId) {
    throw new HttpsError("invalid-argument", "couponId is required.");
  }
  const stripe = stripeClient();
  const deleted = await stripe.coupons.del(couponId);
  return { deleted };
});

/**
 * Raw HTTP endpoint hit directly by Stripe's servers — Stripe's signature
 * verification (not Firebase Auth or App Check) is the security boundary
 * here. Register this URL as a webhook endpoint in the Stripe Dashboard
 * (test mode for the Comtempo sandbox) after first deploy, then
 * `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` with the signing
 * secret Stripe gives you for that endpoint.
 */
export const stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
      res.status(400).send("Missing Stripe-Signature header.");
      return;
    }

    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value());
    } catch (err) {
      logger.warn("stripeWebhook: signature verification failed", { error: String(err) });
      res.status(400).send("Invalid signature.");
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const uid = session.client_reference_id;
          if (uid && session.subscription) {
            const subscription = await stripeClient().subscriptions.retrieve(session.subscription as string);
            await syncSubscription(uid, subscription);
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerDoc = await stripeCustomerDoc(subscription.customer as string).get();
          const uid = customerDoc.data()?.uid as string | undefined;
          if (uid) {
            await syncSubscription(uid, subscription);
          } else {
            logger.warn("stripeWebhook: no uid mapping for customer", { customer: subscription.customer });
          }
          break;
        }
        default:
          break;
      }
      res.status(200).send();
    } catch (err) {
      logger.error("stripeWebhook: handler failed", { error: String(err), type: event.type });
      res.status(500).send();
    }
  }
);
