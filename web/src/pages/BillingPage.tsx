import { getSubscriptionStatus } from "../billing/subscription";

// Same three illustrative tiers as branding/landing_v0/site/index.html's
// #pricing section — kept in sync by hand. Both are explicitly placeholder
// per CLAUDE.md; don't harden these into real prices without checking there.
const TIERS = [
  {
    name: "Starter",
    price: "$0",
    description: "One property, logged properly, at no cost.",
    features: ["1 property", "Unlimited manual, voice & SMS entries", "Core hour tracking & pacing dashboard", "CSV export"],
  },
  {
    name: "Pro",
    price: "$19",
    description: "For hosts running one or more properties as a real operation.",
    features: [
      "Unlimited properties",
      "Passive capture — calendar, PMS, geofence",
      "Legal-grounding copilot",
      "Contemporaneity & readiness scoring",
      "CPA-ready export package",
    ],
    featured: true,
  },
  {
    name: "Portfolio",
    price: "$49",
    description: "For multi-property operators with a household or team.",
    features: ["Everything in Pro", "Household & team logging with constraint checks", "Concierge audit-defense package", "Priority support"],
  },
];

const STATUS_LABEL: Record<string, string> = {
  none: "Not subscribed",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export function BillingPage() {
  const status = getSubscriptionStatus();

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem" }}>Billing</h1>
      <p style={{ color: "var(--ink-soft)" }}>
        Current status: <strong>{STATUS_LABEL[status]}</strong>. Subscriptions are only available
        here on the web — the Android and iOS apps never sell anything in-app.
      </p>
      <div className="viz-root" style={{ marginTop: "1.5rem", color: "var(--ink-faint)", fontSize: "0.85rem" }}>
        Pricing below is illustrative, not final (see reports/prd-v0.html Section 9.4). Checkout
        isn't wired up yet — Stripe integration is a TODO (src/billing/subscription.ts).
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
          marginTop: "1rem",
        }}
      >
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className="chart-card"
            style={tier.featured ? { borderColor: "var(--pine)", borderWidth: 2 } : undefined}
          >
            <h3 style={{ marginBottom: "0.2rem" }}>{tier.name}</h3>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", marginBottom: "0.4rem" }}>
              {tier.price}
              <span style={{ fontSize: "1rem", color: "var(--ink-faint)" }}>/mo</span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{tier.description}</p>
            <ul style={{ fontSize: "0.85rem", paddingLeft: "1.1rem", color: "var(--ink-soft)" }}>
              {tier.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              disabled
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.5rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--hairline-strong)",
                background: "var(--paper)",
                color: "var(--ink-faint)",
                cursor: "not-allowed",
              }}
            >
              Coming soon
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
