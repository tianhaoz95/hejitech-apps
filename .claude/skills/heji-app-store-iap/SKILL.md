---
name: heji-app-store-iap
description: Sell a HEJI app's subscription or one-time unlock inside its iPhone app -- the products in App Store Connect by API (subscription group, auto-renewing subscription with equalized prices in every territory and a free-trial introductory offer, non-consumable lifetime unlock, review screenshots, Server Notifications V2 URL) with iap.mjs, StoreKit 2 in the app with the user id as appAccountToken, and the project's Worker verifying Apple's signed transactions itself (x5c chain pinned to Apple Root CA G3, no SDK) into a purchases table that its plan logic combines with any web (Stripe) plan. Waypack (2026-11-14) is the worked example. Use when asked to "add a subscription", "sell Pro in the app", "in-app purchase", "StoreKit", "paywall", "free trial", "lifetime unlock", "App Store Server Notifications", "restore purchases", or to move a paid-upfront app to in-app purchases.
---

# In-app purchases on the App Store

Waypack is the model, end to end: `projects/waypack/docs/DECISIONS.md` #72 and `docs/DEPLOY.md` §4a,
Worker `services/mcp/src/lib/appstore.ts` (+ `test/appstore.test.ts`), plan logic
`src/lib/entitlements.ts`, app `apps/mobile/lib/services/pro_store.dart` and `lib/widgets/pro_sheet.dart`.
Read the root `CLAUDE.md` first (isolation: each project keeps its own copy of this code; don't import
Waypack's).

## Ask the owner first (prices are theirs)

- Products and prices: same as the web plan or higher (Apple keeps 30%, 15% in the Small Business
  Program, which the team hasn't joined), subscription only or also a lifetime unlock.
- Free trial or not (an introductory offer: `ONE_WEEK`, `ONE_MONTH`, …).
- Which apps sell: StoreKit works only in App Store-distributed apps (not a Mac DMG); Android needs
  Play Billing, a separate job.
- An app that sells in-app may not link to the web checkout (3.1.1); say so if the app does today.

## 1. App Store Connect (by API, idempotent)

```sh
source ~/.config/heji/machine-env.zsh
S=.claude/skills/heji-app-store-iap/iap.mjs
node $S subscription com.hejitech.<app> --group "<App> Pro" --product com.hejitech.<app>.pro.annual \
  --name "<App> Pro Annual" --display "<App> Pro (Annual)" --description "What Pro adds, ≤55 chars" \
  --period ONE_YEAR --price 14.99 --trial ONE_WEEK --note "Where to buy it in the app; demo account notes"
node $S nonconsumable com.hejitech.<app> --product com.hejitech.<app>.pro.lifetime --name "<App> Pro Lifetime" \
  --display "<App> Pro (Lifetime)" --description "…" --price 39.99 --note "…"
node $S notifications com.hejitech.<app> https://<worker>/appstore/notifications
node $S review-shot com.hejitech.<app> <product id> <png of the purchase screen>   # each product
node $S status com.hejitech.<app>
```

What the API does and doesn't do (learned on Waypack):
- A subscription's price is per territory: the US point plus Apple's **equalizations** (175 POSTs).
  A non-consumable takes one price schedule (US base) and Apple equalizes it.
- `GET v2/inAppPurchases/<id>/iapPriceSchedule` answers even when no price exists: check
  `manualPrices` (iap.mjs does). Waypack's lifetime first went without a price because of this.
- A free trial needs one introductory offer **per territory**: the API refuses one without a territory.
- Products stay `MISSING_METADATA` until a review screenshot is uploaded; then `READY_TO_SUBMIT`.
- The **first** in-app purchases are reviewed **with an app version**: on that version's page, add them
  to the submission (the API can't attach them before the version is submitted with them; check the
  web page). The listing description needs Terms of Use (EULA) and privacy links for subscriptions.
- The Paid Apps Agreement must be active (it is for the HEJI team).

## 2. The Worker

Copy and adapt Waypack's `appstore.ts` (bundle id, product → tier map) and its tests, which sign
JWSs with a throwaway openssl chain (`test/fixtures/appstore-chain.json`; how it was made is in the
test file's fixture note):
- `verifyAppStoreJws`: x5c of 3, root **byte-equal** to Apple Root CA - G3 (embedded; SHA-256
  `63343abf…3e9179`, from apple.com/certificateauthority), Apple's marker OIDs on intermediate
  (1.2.840.113635.100.6.2.1) and leaf (…100.6.11.1), validity at `signedDate`, each cert signed by
  the next, then ES256 over the JWS. No SDK: Apple's Node library doesn't fit Workers.
- `POST /api/appstore/transactions` (signed-in): the app posts each `jwsRepresentation`; store one row
  per `originalTransactionId`, newest `signedDate` wins; a restore from another account moves it.
- `POST /appstore/notifications` (public): verify `signedPayload` and its `signedTransactionInfo`,
  dedupe on `notificationUUID`, find the user by the stored original transaction or `appAccountToken`.
- Plan = best of web plan and active App Store purchases; tell the app where it comes from
  (`plan_source`) so it shows "Manage subscription" only for App Store plans.
- Accept Sandbox transactions in production: TestFlight and App Review buy in the sandbox.
- A new table: the project's `supabase/schemas/<project>/`, then `scripts/db_migration.sh`; the
  production `supabase db push` and deploy are owner-approved steps.

## 3. The app

- Flutter: `in_app_purchase` (StoreKit 2 is its default) + `in_app_purchase_storekit` for
  `SK2Product.isIntroductoryOfferEligible`. Pass the user id (a UUID) as `applicationUserName`: it
  becomes `appAccountToken`. `serverVerificationData` is the JWS. Finish (`completePurchase`) only after
  the Worker accepted it; unfinished transactions come back at the next launch. Native Swift: the same
  with `Product.purchase(options: [.appAccountToken(uuid)])` and `Transaction.updates`.
- The purchase screen (guideline 3.1.2): price per period, the trial only when eligible, renewal and
  cancellation text, Restore Purchases, Terms of Use (Apple's standard EULA unless the app has its own)
  and privacy links, and "Manage subscription" (`https://apps.apple.com/account/subscriptions`).
- Account deletion can't cancel an App Store subscription: say so in the confirmation.

## 4. Test

- Products load in a Debug build on the simulator or a device from the sandbox once they have a
  name and a price, before review; a product priced minutes ago may not show for a while.
- `flutter drive` with a driver that saves `binding.takeScreenshot` to the host gives the review
  screenshot (Waypack: `integration_test/pro_test.dart`, `test_driver/integration_test.dart`).
- A physical iPhone reaching the Mac's local stack over Wi-Fi shows iOS's local-network prompt the
  first time: someone has to tap Allow on the phone.
- Buying needs a person at Apple's sheet: a TestFlight build buys with the tester's own Apple Account
  for free (subscriptions renew every few minutes), and the real JWS then exercises the Worker. Xcode
  StoreKit configuration files sign with Xcode's own certificate, which the Worker rightly rejects.
