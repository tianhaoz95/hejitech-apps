# Icecap Implementation Task List

## Legend
- [ ] Pending
- [x] Completed
- [~] In Progress

---

## Phase 0: Monorepo Foundation

- [x] 0.1 Initialize pnpm workspace at repo root (`pnpm-workspace.yaml`)
- [x] 0.2 Root `package.json` with Turborepo + shared scripts
- [x] 0.3 Install Turborepo and configure `turbo.json`
- [x] 0.4 Root `.gitignore` and `.npmrc`
- [x] 0.5 Root TypeScript config (`tsconfig.base.json`)

---

## Phase 1: Shared Packages

### 1.1 `packages/types` — TypeScript definitions
- [x] 1.1.1 Property types (PropertyData, Metrics, AnalysisMode)
- [x] 1.1.2 User / Subscription types (UserProfile, Subscription, SubscriptionTier, SubscriptionStatus)
- [x] 1.1.3 Promo code types
- [x] 1.1.4 API contract types (RentEstimateRequest/Response, etc.)
- [x] 1.1.5 Package build setup

### 1.2 `packages/math` — Financial calculation engine
- [x] 1.2.1 Rental metrics: monthly mortgage, cash flow, cap rate, CoC, GRM, 1% rule
- [x] 1.2.2 Flip metrics: profit, ROI, MAO (70% rule)
- [x] 1.2.3 BRRRR metrics: combined rental + flip
- [x] 1.2.4 Input validation helpers
- [x] 1.2.5 Unit tests (vitest) — comprehensive coverage
- [x] 1.2.6 Package build setup

### 1.3 `packages/theme` — Design tokens & Tailwind
- [x] 1.3.1 Tailwind config with Icecap color palette (Blue-600, Green-600, Red-600, Purple-600)
- [x] 1.3.2 Typography tokens (Inter font)
- [x] 1.3.3 Border radius tokens
- [x] 1.3.4 Package export

### 1.4 `packages/ui` — Shared component library
- [x] 1.4.1 Button component (primary, secondary, danger)
- [x] 1.4.2 Input component (with bottom-border focus style)
- [x] 1.4.3 Slider component (with badge display)
- [x] 1.4.4 ResultCard (The "Pulse" — blue bg, 2-col grid metrics)
- [x] 1.4.5 StrategyToggle (pill-shaped Rental/Flip toggle)
- [x] 1.4.6 AIInsightBox (Purple-50 bg, Sparkles icon)
- [x] 1.4.7 Badge component (profit/loss color logic)
- [x] 1.4.8 Package build setup

---

## Phase 2: Firebase Backend

### 2.1 Firebase configuration
- [x] 2.1.1 `firebase/firebase.json` — multi-site hosting + emulator config
- [x] 2.1.2 `firebase/.firebaserc` — project aliases
- [x] 2.1.3 `firebase/firestore.rules` — strict data isolation per user
- [x] 2.1.4 `firebase/firestore.indexes.json`
- [x] 2.1.5 `firebase/storage.rules`

### 2.2 Cloud Functions (`firebase/functions/`)
- [x] 2.2.1 TypeScript setup for functions
- [x] 2.2.2 `getRentEstimate` — heuristic + RentCast stub
- [x] 2.2.3 `createCheckoutSession` — Stripe Checkout session creation
- [x] 2.2.4 `stripeWebhook` — handle subscription events, sync to Firestore
- [x] 2.2.5 `validatePromoCode` — check Firestore promo_codes collection
- [x] 2.2.6 `manageSubscription` — admin overrides (quota, status)
- [x] 2.2.7 AI proxy stub (`analyzeProperty`) — returns mock response for emulator phase
- [x] 2.2.8 Function unit tests

---

## Phase 3: Chrome Extension (`apps/extension`)

### 3.1 Plasmo project setup
- [x] 3.1.1 `package.json` with Plasmo + React + Tailwind + Zustand
- [x] 3.1.2 `tsconfig.json`
- [x] 3.1.3 Plasmo manifest (permissions: sidePanel, tabs, activeTab)
- [x] 3.1.4 Tailwind CSS setup using `packages/theme`

### 3.2 Core state & Firebase
- [x] 3.2.1 Zustand store (property data + assumptions)
- [x] 3.2.2 Firebase client config (emulator-aware)
- [x] 3.2.3 Auth hook (`useAuth`)
- [x] 3.2.4 Firestore save/load helpers

### 3.3 Content scripts
- [x] 3.3.1 `contents/redfin.ts` — scrape price, taxes, HOA, address, description + map badge injection
- [x] 3.3.2 `contents/zillow.ts` — scrape + map badge injection
- [x] 3.3.3 `contents/realtor.ts` — scrape + map badge injection
- [x] 3.3.4 Message passing protocol (content → sidepanel)

### 3.4 Side panel UI
- [x] 3.4.1 `sidepanel.tsx` — main layout, global header, utility bar
- [x] 3.4.2 Strategy toggle (Rental / Flip)
- [x] 3.4.3 Property data inputs (price, rent/ARV, taxes, HOA, rehab)
- [x] 3.4.4 Assumptions section (down payment slider, interest rate slider)
- [x] 3.4.5 The "Pulse" result card (rental + flip modes)
- [x] 3.4.6 AI insight section (Purple-50, Sparkles, quota display, confirm before action)
- [x] 3.4.7 Save to Firestore flow
- [x] 3.4.8 Export to CSV
- [x] 3.4.9 Auth UI (login/logout, user display)
- [x] 3.4.10 Subscription gate (show upgrade prompt if not active/trialling)

### 3.5 Background service worker
- [x] 3.5.1 `background.ts` — open side panel on icon click

---

## Phase 4: Hub Web App (`apps/hub`)

### 4.1 Vite project setup
- [x] 4.1.1 `package.json`, `vite.config.ts`, `tsconfig.json`
- [x] 4.1.2 React Router setup
- [x] 4.1.3 Tailwind setup using `packages/theme`
- [x] 4.1.4 Firebase client config (emulator-aware)

### 4.2 Auth & routing
- [x] 4.2.1 Login page (Google Sign-In via Firebase)
- [x] 4.2.2 Protected route wrapper
- [x] 4.2.3 Subscription gate (redirect to /subscribe if no active sub)

### 4.3 Dashboard pages
- [x] 4.3.1 Fixed sidebar nav (Dashboard, Portfolio, Compare, Settings)
- [x] 4.3.2 Dashboard page — Stats strip (Total Value, Net Cashflow, Avg Cap Rate)
- [x] 4.3.3 Portfolio page — Deal grid with deal cards
- [x] 4.3.4 Deal detail modal/page — full financial breakdown
- [x] 4.3.5 Comparison page — side-by-side matrix view
- [x] 4.3.6 Settings page — default assumptions (down payment, rate, etc.)

### 4.4 Subscription flow
- [x] 4.4.1 `/subscribe` page — plan selection (Pro $19, Pro Max $49)
- [x] 4.4.2 Promo code redemption form
- [x] 4.4.3 Stripe Checkout redirect (via `createCheckoutSession` function)
- [x] 4.4.4 `/subscribe/success` page — post-checkout confirmation
- [x] 4.4.5 `/subscribe/cancel` page
- [x] 4.4.6 Billing suspended overlay (`past_due` / `unpaid` state)

### 4.5 Notification center
- [x] 4.5.1 In-app notification bell
- [x] 4.5.2 Trial expiry reminders
- [x] 4.5.3 AI quota alerts

---

## Phase 5: Admin Portal (`apps/admin`)

### 5.1 Vite project setup
- [x] 5.1.1 `package.json`, `vite.config.ts`
- [x] 5.1.2 Firebase client config (RBAC via custom claims)
- [x] 5.1.3 Admin auth guard (requires `admin: true` custom claim)

### 5.2 Admin pages
- [x] 5.2.1 System health dashboard (function health, latency, 3rd-party status)
- [x] 5.2.2 User management (impersonation read-only, quota override, subscription status)
- [x] 5.2.3 Scraper health (failure heatmap, remote selector management)
- [x] 5.2.4 Promo code management (create, list, usage tracking)

---

## Phase 6: Landing Page (`apps/landing`)

### 6.1 Vite project setup
- [x] 6.1.1 `package.json`, `vite.config.ts`
- [x] 6.1.2 Tailwind setup

### 6.2 Landing page sections
- [x] 6.2.1 Hero section (headline, CTA to Chrome Web Store + Hub)
- [x] 6.2.2 Problem/Solution section
- [x] 6.2.3 Feature highlights (Extension + Hub + AI)
- [x] 6.2.4 Pricing section (Pro / Pro Max)
- [x] 6.2.5 Testimonials section (placeholder)
- [x] 6.2.6 Footer with links to legal, hub, extension

---

## Phase 7: Legal Site (`apps/legal`)

- [x] 7.1 Vite static setup
- [x] 7.2 Privacy Policy page
- [x] 7.3 Terms of Service page
- [x] 7.4 Navigation between docs

---

## Phase 8: Stripe Mock (`apps/stripe-mock`)

- [x] 8.1 Express server setup
- [x] 8.2 `POST /create-checkout-session` — returns mock session URL
- [x] 8.3 Mock checkout page (HTML) — enter test card details
- [x] 8.4 `POST /trigger-webhook` — fires `customer.subscription.updated` to local functions
- [x] 8.5 Webhook payload builder (trialling, active, past_due, cancelled)
- [x] 8.6 `GET /subscriptions/:id` — mock subscription status endpoint

---

## Phase 9: End-to-End Tests

### 9.1 Test infrastructure
- [x] 9.1.1 `tests/` directory with Playwright config
- [x] 9.1.2 Firebase emulator startup helper
- [x] 9.1.3 Stripe-mock startup helper
- [x] 9.1.4 Extension build fixture

### 9.2 Extension tests
- [x] 9.2.1 Side panel loads and shows calculator
- [x] 9.2.2 Price input triggers metric recalculation
- [x] 9.2.3 Rental/Flip mode toggle works
- [x] 9.2.4 Slider updates assumption and recomputes
- [x] 9.2.5 Save to Firestore (emulated) works

### 9.3 Hub tests
- [x] 9.3.1 Hub login page renders
- [x] 9.3.2 Auth flow (sign in → redirected to dashboard)
- [x] 9.3.3 Stats strip shows correct aggregate data
- [x] 9.3.4 Deal card delete flow

### 9.4 Golden path test
- [x] 9.4.1 Full sync: analyze in extension → save → verify in hub

### 9.5 Subscription flow tests
- [x] 9.5.1 Subscribe page shows plans
- [x] 9.5.2 Stripe checkout redirect (stripe-mock)
- [x] 9.5.3 Webhook updates Firestore subscription status
- [x] 9.5.4 Active subscriber sees full features; expired sees gate

### 9.6 Math unit tests
- [x] 9.6.1 Rental metrics accuracy
- [x] 9.6.2 Flip metrics accuracy
- [x] 9.6.3 Edge cases (zero price, zero rent)

---

## Phase 10: Dev Environment & CI

- [x] 10.1 Root `Makefile` or scripts for `dev`, `build`, `test`, `emulator`
- [x] 10.2 `.env.example` files for each app
- [x] 10.3 GitHub Actions CI workflow
- [x] 10.4 Firebase emulator seed data script
- [x] 10.5 CLAUDE.md with architecture overview

---

## Current Status
**Started:** 2026-04-23
**Phase 0:** Complete
**Phase 1:** Complete  
**Phase 2:** Complete
**Phase 3:** Complete
**Phase 4:** Complete
**Phase 5:** Complete
**Phase 6:** Complete
**Phase 7:** Complete
**Phase 8:** Complete
**Phase 9:** Complete
**Phase 10:** Complete
