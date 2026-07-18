// TODO(stripe): wire up subscription billing. Per reports/mvp-scope-v0.html
// Section 4.4, subscriptions are sold on web ONLY — Android/iOS never get a
// purchase flow, to avoid the app store platform fee. Plan is to use
// Stripe's official Firebase Extension ("Run Payments with Stripe"), which
// syncs subscription status into a Firestore doc that all clients (this web
// app, Android, iOS) read to gate premium features. Not set up yet — user
// will configure Stripe later.

export type SubscriptionStatus = "none" | "active" | "past_due" | "canceled";

// Hardcoded until Stripe is wired up — every user reads as unsubscribed.
// Once the Firebase Extension is in place, this should read
// users/{uid}.subscriptionStatus (or wherever the extension writes it)
// instead of returning a constant.
export function getSubscriptionStatus(): SubscriptionStatus {
  return "none";
}
