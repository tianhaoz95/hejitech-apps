// What G2 Digest Pro is called and sold as on every store; billing.ts and appstore.ts read it.
export type Tier = "annual" | "lifetime";

export const PRO = {
  /** Tags everything this Worker creates on the shared HEJI Stripe account (metadata app=…). */
  app: "g2digest",
  name: "G2 Digest Pro",
  bundleId: "com.hejitech.g2digest",
  appStoreProducts: {
    "com.hejitech.g2digest.pro.annual": "annual",
    "com.hejitech.g2digest.pro.lifetime": "lifetime",
  } as Record<string, Tier>,
  /** The web page with the paywall and the plan; Stripe Checkout and the portal return here. */
  accountPath: "/pro/",
  /** The free week on the yearly plan, as on the App Store (once per account, any store). */
  trialDays: 7,
};
