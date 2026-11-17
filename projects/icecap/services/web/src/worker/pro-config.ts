// What Icecap Pro is called and sold as; billing.ts reads it.
export type Tier = "annual" | "lifetime";

export const PRO = {
  /** Tags everything this Worker creates on the shared HEJI Stripe account (metadata app=…). */
  app: "icecap",
  name: "Icecap Pro",
  /** The web app's billing page; Stripe Checkout and the portal return here. */
  accountPath: "/app/billing",
  /** Where someone without Pro is sent to buy it. */
  subscribePath: "/app/subscribe",
  /** The free week on the yearly plan (once per account). */
  trialDays: 7,
};
