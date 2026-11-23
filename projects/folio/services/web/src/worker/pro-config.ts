// What Folio Pro is called and sold as on every store; billing.ts, appstore.ts and plan.ts read it.
export type Tier = "annual" | "lifetime";

export const PRO = {
  /** Tags everything this Worker creates on the shared HEJI Stripe account (metadata app=…). */
  app: "folio",
  name: "Folio Pro",
  bundleId: "com.hejitech.folio",
  appStoreProducts: {
    "com.hejitech.folio.pro.annual": "annual",
    "com.hejitech.folio.pro.lifetime": "lifetime",
  } as Record<string, Tier>,
  /** The web page with the plans; Stripe Checkout and the portal return here. */
  accountPath: "/pro/",
  /** The free week on the yearly plan, as on the App Store (once per account, any store). */
  trialDays: 7,
};
