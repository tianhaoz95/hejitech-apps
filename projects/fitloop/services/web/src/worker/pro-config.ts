// What FitLoop Pro is called and sold as on every store; billing.ts and appstore.ts read it.
export type Tier = "annual" | "lifetime";

export const PRO = {
  /** Tags everything this Worker creates on the shared HEJI Stripe account (metadata app=…). */
  app: "fitloop",
  name: "FitLoop Pro",
  bundleId: "com.hejitech.fitloop",
  appStoreProducts: {
    "com.hejitech.fitloop.pro.annual": "annual",
    "com.hejitech.fitloop.pro.lifetime": "lifetime",
  } as Record<string, Tier>,
  /** The web page with the paywall and the plan; Stripe Checkout and the portal return here. */
  accountPath: "/pro/",
  /** The free week on the yearly plan, as on the App Store (once per account, any store). */
  trialDays: 7,
};
