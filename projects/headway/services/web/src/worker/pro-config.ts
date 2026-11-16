// What Headway Pro is called and sold as on every store; billing.ts and appstore.ts read it.
export type Tier = "annual" | "lifetime";

export const PRO = {
  /** Tags everything this Worker creates on the shared HEJI Stripe account (metadata app=…). */
  app: "headway",
  name: "Headway Pro",
  bundleId: "com.hejitech.headway",
  appStoreProducts: {
    "com.hejitech.headway.pro.annual": "annual",
    "com.hejitech.headway.pro.lifetime": "lifetime",
  } as Record<string, Tier>,
  /** Google Play: the Android app's package and its Pro products (a subscription with a yearly base plan, a one-time product). */
  packageName: "com.hejitech.headway",
  playProducts: { annual: "pro_annual", lifetime: "pro_lifetime" },
  /** The web page with the paywall and the plan; Stripe Checkout and the portal return here. */
  accountPath: "/settings/",
  /** The free week on the yearly plan, as on the App Store (once per account, any store). */
  trialDays: 7,
};
