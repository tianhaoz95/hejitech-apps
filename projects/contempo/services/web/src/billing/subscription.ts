// Direct Stripe integration via backend/functions/src/billing.ts — not the
// "Run Payments with Stripe" Firebase Extension originally planned here. That
// extension is scheduled to shut down March 31, 2027 with no migration path
// published yet, a bad foundation for a product that hasn't launched. See
// reports/pricing-proposal-v0.html for the tier this backs.

import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, supabase } from "../lib/supabase";

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
    let cancelled = false;
    // contempo.subscriptions is written only by the Worker's Stripe webhook; read-only here.
    const load = async () => {
      const { data } = await supabase.from("subscriptions").select("status, price_id, cancel_at_period_end").maybeSingle();
      if (cancelled) return;
      setState({
        status: (data?.status as SubscriptionStatus) ?? "none",
        priceId: (data?.price_id as string) ?? null,
        cancelAtPeriodEnd: Boolean(data?.cancel_at_period_end),
        loading: false,
      });
    };
    void load();
    const channel = supabase
      .channel(`contempo-subscription-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "contempo", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return state;
}

/** Starts a Stripe Checkout session for the given price and redirects the browser to it. */
export async function startCheckout(priceId: string): Promise<void> {
  const { url } = await api<{ url: string }>("billing/checkout", {
    priceId,
    successUrl: `${window.location.origin}/billing?checkout=success`,
    cancelUrl: `${window.location.origin}/billing?checkout=canceled`,
  });
  window.location.assign(url);
}

export async function openBillingPortal(): Promise<void> {
  const { url } = await api<{ url: string }>("billing/portal", { returnUrl: `${window.location.origin}/billing` });
  window.location.assign(url);
}
