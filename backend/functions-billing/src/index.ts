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
