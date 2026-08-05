// Direct Stripe integration via backend/functions/src/billing.ts — not the
// "Run Payments with Stripe" Firebase Extension originally planned here. That
// extension is scheduled to shut down March 31, 2027 with no migration path
// published yet, a bad foundation for a product that hasn't launched. See
// reports/pricing-proposal-v0.html for the tier this backs.

import { doc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { db, functions } from "../lib/firebase";

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export interface SubscriptionState {
  status: SubscriptionStatus;
  priceId: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
}

// users/{uid}/billing/subscription — synced only by the stripeWebhook Cloud
// Function (see backend/firestore.rules: client write is denied there).
export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    status: "none",
    priceId: null,
    cancelAtPeriodEnd: false,
    loading: true,
  });

  useEffect(() => {
    if (!user) {
      setState({ status: "none", priceId: null, cancelAtPeriodEnd: false, loading: false });
      return;
    }
    return onSnapshot(doc(db, "users", user.uid, "billing", "subscription"), (snap) => {
      const data = snap.data();
      setState({
        status: (data?.status as SubscriptionStatus) ?? "none",
        priceId: (data?.priceId as string) ?? null,
        cancelAtPeriodEnd: Boolean(data?.cancelAtPeriodEnd),
        loading: false,
      });
    });
  }, [user]);

  return state;
}

/** Starts a Stripe Checkout session for the given price and redirects the browser to it. */
export async function startCheckout(priceId: string): Promise<void> {
  const createCheckoutSession = httpsCallable<
    { priceId: string; successUrl: string; cancelUrl: string },
    { url: string }
  >(functions, "createCheckoutSession");

  const { data } = await createCheckoutSession({
    priceId,
    successUrl: `${window.location.origin}/billing?checkout=success`,
    cancelUrl: `${window.location.origin}/billing?checkout=canceled`,
  });
  window.location.assign(data.url);
}

/** Opens Stripe's hosted customer portal for an existing subscriber to manage/cancel their plan. */
export async function openBillingPortal(): Promise<void> {
  const createPortalLink = httpsCallable<{ returnUrl: string }, { url: string }>(
    functions,
    "createPortalLink"
  );
  const { data } = await createPortalLink({ returnUrl: `${window.location.origin}/billing` });
  window.location.assign(data.url);
}
