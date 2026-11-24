// What Contempo Pro is called and sold as on every store; billing.ts, appstore.ts and play.ts read it.
export type Tier = "annual" | "lifetime";

export const PRO = {
  /** Tags everything this Worker creates on the shared HEJI Stripe account (metadata app=…). */
  app: "contempo",
  name: "Contempo Pro",
  bundleId: "com.hejitech.contempoapp",
  appStoreProducts: {
    "com.hejitech.contempoapp.pro.annual": "annual",
    "com.hejitech.contempoapp.pro.lifetime": "lifetime",
  } as Record<string, Tier>,
  /** Google Play: the Android app's package and its Pro products (a yearly subscription, a one-time unlock). */
  packageName: "com.hejitech.contempoapp",
  playProducts: { annual: "pro_annual", lifetime: "pro_lifetime" },
  /** The web page with the paywall and the plan; Stripe Checkout and the portal return here. */
  accountPath: "/billing",
  /** The free week on the yearly plan, as on the App Store (once per account, any store). */
  trialDays: 7,
};
