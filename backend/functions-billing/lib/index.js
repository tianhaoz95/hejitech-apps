"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.createPortalLink = exports.createCheckoutSession = void 0;
const https_1 = require("firebase-functions/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const stripe_1 = __importDefault(require("stripe"));
const logger = __importStar(require("firebase-functions/logger"));
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
(0, app_1.initializeApp)();
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
function stripeClient() {
    return new stripe_1.default(stripeSecretKey.value());
}
/** users/{uid}/billing/subscription — client-readable, server-write-only (see firestore.rules). */
function subscriptionDoc(uid) {
    return (0, firestore_1.getFirestore)().collection("users").doc(uid).collection("billing").doc("subscription");
}
/**
 * Maps a Stripe customer back to a Firebase uid without an extra Stripe API
 * call from the webhook — written once, at customer-creation time, in
 * createCheckoutSession below. Admin-only; never read or written by a
 * client (see firestore.rules).
 */
function stripeCustomerDoc(customerId) {
    return (0, firestore_1.getFirestore)().collection("stripeCustomers").doc(customerId);
}
async function getOrCreateStripeCustomer(uid, email) {
    const existing = await subscriptionDoc(uid).get();
    const existingId = existing.data()?.stripeCustomerId;
    if (existingId)
        return existingId;
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
exports.createCheckoutSession = (0, https_1.onCall)({ secrets: [stripeSecretKey], enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in before starting checkout.");
    }
    const { priceId, successUrl, cancelUrl } = request.data;
    if (!priceId || !successUrl || !cancelUrl) {
        throw new https_1.HttpsError("invalid-argument", "priceId, successUrl, and cancelUrl are required.");
    }
    const uid = request.auth.uid;
    const customerId = await getOrCreateStripeCustomer(uid, request.auth.token.email);
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
});
/** Lets a Pro subscriber manage or cancel their plan via Stripe's hosted portal. */
exports.createPortalLink = (0, https_1.onCall)({ secrets: [stripeSecretKey], enforceAppCheck: false }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Sign in before managing your plan.");
    }
    const { returnUrl } = request.data;
    if (!returnUrl) {
        throw new https_1.HttpsError("invalid-argument", "returnUrl is required.");
    }
    const uid = request.auth.uid;
    const snap = await subscriptionDoc(uid).get();
    const customerId = snap.data()?.stripeCustomerId;
    if (!customerId) {
        throw new https_1.HttpsError("failed-precondition", "No billing account yet — start checkout first.");
    }
    const stripe = stripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
    return { url: portalSession.url };
});
async function syncSubscription(uid, subscription) {
    const price = subscription.items.data[0]?.price;
    await subscriptionDoc(uid).set({
        stripeCustomerId: subscription.customer,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        priceId: price?.id ?? null,
        currentPeriodEnd: subscription.items.data[0]?.current_period_end
            ? firestore_1.Timestamp.fromMillis(subscription.items.data[0].current_period_end * 1000)
            : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
/**
 * Raw HTTP endpoint hit directly by Stripe's servers — Stripe's signature
 * verification (not Firebase Auth or App Check) is the security boundary
 * here. Register this URL as a webhook endpoint in the Stripe Dashboard
 * (test mode for the Comtempo sandbox) after first deploy, then
 * `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` with the signing
 * secret Stripe gives you for that endpoint.
 */
exports.stripeWebhook = (0, https_1.onRequest)({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string") {
        res.status(400).send("Missing Stripe-Signature header.");
        return;
    }
    let event;
    try {
        event = stripeClient().webhooks.constructEvent(req.rawBody, signature, stripeWebhookSecret.value());
    }
    catch (err) {
        logger.warn("stripeWebhook: signature verification failed", { error: String(err) });
        res.status(400).send("Invalid signature.");
        return;
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const uid = session.client_reference_id;
                if (uid && session.subscription) {
                    const subscription = await stripeClient().subscriptions.retrieve(session.subscription);
                    await syncSubscription(uid, subscription);
                }
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                const customerDoc = await stripeCustomerDoc(subscription.customer).get();
                const uid = customerDoc.data()?.uid;
                if (uid) {
                    await syncSubscription(uid, subscription);
                }
                else {
                    logger.warn("stripeWebhook: no uid mapping for customer", { customer: subscription.customer });
                }
                break;
            }
            default:
                break;
        }
        res.status(200).send();
    }
    catch (err) {
        logger.error("stripeWebhook: handler failed", { error: String(err), type: event.type });
        res.status(500).send();
    }
});
//# sourceMappingURL=index.js.map