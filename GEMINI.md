# Gemini Instructional Context: Icecap Platform

This document provides architectural overview, development workflows, and engineering standards for the Icecap Residential Real Estate Investment Analyzer monorepo.

## 🏗️ Project Overview
Icecap is a dual-interface investment analysis platform:
- **The "Wedge" (Chrome Extension):** Built with **Plasmo**, React, and Zustand. Injects into Redfin, Zillow, and Realtor.com for real-time property scraping and "Napkin Math" (Cap Rate, CoC, ROI).
- **The "Hub" (Web Dashboard):** A standalone **Vite/React** application for portfolio management, multi-property comparison, and AI-powered deal summaries.

### Tech Stack
- **Frontend:** React (TypeScript), Tailwind CSS, Lucide Icons, Zustand (State Management).
- **Backend:** Firebase (Auth, Firestore, Cloud Functions, Hosting).
- **Monorepo:** Turborepo, pnpm workspaces.
- **Infrastructure:** Stripe (Payments), Gemini 1.5 Flash (AI Analysis), Playwright (E2E Testing).

---

## 📂 Monorepo Structure

### Applications (`apps/`)
- `extension/`: Chrome extension (The Wedge). Features content scripts for DOM scraping.
- `hub/`: Main user dashboard for deal management.
- `admin/`: Internal portal for scraper health, support ops, and system monitoring.
- `landing/`: Marketing and user acquisition site.
- `legal/`: Compliance documents (Privacy Policy, TOS).
- `stripe-mock/`: Developer utility for local Stripe webhook simulation.

### Shared Packages (`packages/`)
- `math/`: Core financial logic (Cap Rate, 1% Rule, GRM, etc.). Single source of truth for metrics.
- `ui/`: "The Icecap Blueprint" — shared React component library.
- `theme/`: Tailwind tokens and brand design configuration.
- `types/`: Shared TypeScript interfaces and API contracts.

---

## 🚀 Building and Running

### Prerequisites
- Node.js >= 18, pnpm >= 9.
- Firebase CLI installed globally.

### Key Commands
- **Install:** `pnpm install`
- **Full Build:** `pnpm turbo run build`
- **E2E Tests:** `pnpm run test:e2e` (runs all integration tests in a clean environment).
- **Development (Everything):** `pnpm run dev:all` (starts emulator, official Stripe CLI listener, and app servers).
- **Development (Stripe Mock):** `pnpm run dev:all --mock` (starts emulator and internal stripe-mock; deprecated).
- **Development (Apps only):** `pnpm dev` (opens all Vite apps automatically).
- **Firebase Emulator:** `pnpm run emulator` (runs Auth, Firestore, Functions, Hosting).
- **Seed Data:** `pnpm run emulator:seed` (populates local environment with test accounts/deals).

---

## 🧪 Testing & Validation

### Unit Tests
Focused on the `math` engine:
```bash
pnpm turbo run test --filter=@icecap/math
```

### End-to-End (E2E) Tests
Playwright suite verifying the "Golden Path" (Scrape -> Save -> Sync -> Hub):
```bash
pnpm --filter @icecap/tests test
```
*Note: E2E tests require the Firebase Emulator and either Stripe CLI (default) or Stripe Mock to be active.*

### 📸 Store Screenshots
Generate high-resolution marketing assets for the Chrome Web Store:
```bash
pnpm --filter @icecap/extension build:prod
pnpm --filter @icecap/tests playwright test tests/screenshots.spec.ts --project=extension
```
Assets are stored in `reports/screenshots/`.

---

## 🛠️ Development Conventions

### Authentication & Gatekeeping
- Mandatory user accounts via Google (Firebase Auth).
- **Subscription Gate:** Features are restricted based on `status: 'active' | 'trialling'` in the `subscriptions` collection.
- **Login Fallback:** Extension sidepanel uses a centered popup (`options.html?view=login`) as a fallback when standard popups are blocked by MV3 restrictions.

### Data & Sync
- **Scraping:** DOM-based scraping in the extension updates a Zustand store, which then syncs to Firestore.
- **Emulator Parity:** Always use `127.0.0.1` for emulator connections to ensure IPv4 consistency.
- **Environment Variables:** Reference `.env.example` in each app directory. Plasmo variables must be prefixed with `PLASMO_PUBLIC_`.

### Stripe Secrets & Environments
- **Local Development (Default):** Use `pnpm run dev:all`. Starts official Stripe CLI listener. Ensure `STRIPE_SECRET_KEY` is set in `firebase/functions/.env` to your `sk_test_...` key.
- **Local Development (Mock):** Use `pnpm run dev:all --mock`. Uses internal `stripe-mock` (deprecated). `STRIPE_SECRET_KEY` defaults to `sk_test_mock`.
- **Testing (Stripe Test Mode):** 
  - Use `STRIPE_SECRET_KEY_TEST` (starts with `sk_test_`).
  - Use `STRIPE_WEBHOOK_SECRET_TEST` (starts with `whsec_`).
  - Required for staging/CI environments and verifying real-world logic against Stripe's test servers.
- **Production:**
  - Use `STRIPE_SECRET_KEY` (starts with `sk_live_`).
  - Use `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`).
  - These keys must be stored in GitHub Repository Secrets and Firebase Secrets. Never commit them to the repository.

### AI Guidelines
- **On-Demand:** AI deal analysis must be explicitly user-triggered to preserve quotas.
- **Propose-Confirm:** AI agents (Co-Pilot) must never modify data without explicit user confirmation.
