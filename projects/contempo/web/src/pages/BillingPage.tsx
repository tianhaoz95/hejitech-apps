import { useState } from "react";
import { openBillingPortal, startCheckout, useSubscription } from "../billing/subscription";

// Real Contempo Pro product/prices, live mode, on the HEJI TECHNOLOGY LLC
// Stripe account (see reports/pricing-proposal-v0.html for the pricing
// rationale). Real charges are possible — there's no test-card safety net
// here anymore, unlike the earlier Comtempo sandbox this replaced.
const MONTHLY_PRICE_ID = "price_1U0r2KJiNqYDPd3oclL5Qqre";
const ANNUAL_PRICE_ID = "price_1U0r2RJiNqYDPd3oMJbvYkvk";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

const STATUS_LABEL: Record<string, string> = {
  none: "Not subscribed",
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  unpaid: "Unpaid",
  paused: "Paused",
};

export function BillingPage() {
  const subscription = useSubscription();
  const [pending, setPending] = useState<"monthly" | "annual" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isPro = ACTIVE_STATUSES.has(subscription.status);

  async function handleCheckout(priceId: string, which: "monthly" | "annual") {
    setError(null);
    setPending(which);
    try {
      await startCheckout(priceId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout — try again.");
      setPending(null);
    }
  }

  async function handlePortal() {
    setError(null);
    setPending("portal");
    try {
      await openBillingPortal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the billing portal — try again.");
      setPending(null);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem" }}>Billing</h1>
      <p style={{ color: "var(--ink-soft)" }}>
        {subscription.loading ? (
          "Loading..."
        ) : (
          <>
            Current status: <strong>{STATUS_LABEL[subscription.status]}</strong>
            {subscription.cancelAtPeriodEnd && " (cancels at period end)"}
          </>
        )}
        . Subscriptions are only available here on the web — the Android and iOS apps never sell
        anything in-app.
      </p>
      {error && (
        <p style={{ color: "var(--danger, #b3261e)", fontSize: "0.85rem" }}>{error}</p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
          marginTop: "1.5rem",
        }}
      >
        <div className="chart-card">
          <h3 style={{ marginBottom: "0.2rem" }}>Free</h3>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", marginBottom: "0.4rem" }}>
            $0
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            One property, logged properly, at no cost.
          </p>
          <ul style={{ fontSize: "0.85rem", paddingLeft: "1.1rem", color: "var(--ink-soft)" }}>
            <li>1 property</li>
            <li>Unlimited manual &amp; voice entries, timers &amp; mileage trips</li>
            <li>Core hour tracking &amp; pacing dashboard</li>
            <li>CSV export</li>
          </ul>
        </div>

        <div className="chart-card" style={{ borderColor: "var(--pine)", borderWidth: 2 }}>
          <h3 style={{ marginBottom: "0.2rem" }}>Pro</h3>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", marginBottom: "0.4rem" }}>
            $9.99<span style={{ fontSize: "1rem", color: "var(--ink-faint)" }}>/mo</span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            Unlimited properties plus the legal copilot and CPA-ready export.
          </p>
          <ul style={{ fontSize: "0.85rem", paddingLeft: "1.1rem", color: "var(--ink-soft)" }}>
            <li>Everything in Free</li>
            <li>Unlimited properties</li>
            <li>Legal-grounding copilot</li>
            <li>Unlimited photo/odometer storage</li>
            <li>CPA-ready export package</li>
          </ul>

          {isPro ? (
            <button
              onClick={handlePortal}
              disabled={pending !== null}
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.5rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--pine)",
                background: "var(--pine)",
                color: "white",
                cursor: pending ? "wait" : "pointer",
              }}
            >
              {pending === "portal" ? "Opening..." : "Manage plan"}
            </button>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <button
                onClick={() => handleCheckout(MONTHLY_PRICE_ID, "monthly")}
                disabled={pending !== null}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--pine)",
                  background: "var(--pine)",
                  color: "white",
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                {pending === "monthly" ? "Starting..." : "Subscribe monthly"}
              </button>
              <button
                onClick={() => handleCheckout(ANNUAL_PRICE_ID, "annual")}
                disabled={pending !== null}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--pine)",
                  background: "var(--paper)",
                  color: "var(--pine)",
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                {pending === "annual" ? "Starting..." : "Subscribe yearly ($99)"}
              </button>
            </div>
          )}
        </div>
      </div>
      <p style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "var(--ink-faint)" }}>
        See reports/pricing-proposal-v0.html for the pricing rationale.
      </p>
    </div>
  );
}
