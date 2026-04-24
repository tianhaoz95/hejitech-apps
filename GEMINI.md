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
- **Development (Parallel):** `pnpm dev` (opens all Vite apps automatically).
- **Firebase Emulator:** `pnpm run emulator` (runs Auth, Firestore, Functions, Hosting).
- **Seed Data:** `pnpm run emulator:seed` (populates local environment with test accounts/deals).
- **Stripe Mock:** `pnpm run dev:stripe-mock` (required for subscription flow testing).

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
*Note: E2E tests require the Firebase Emulator and Stripe Mock to be active.*

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

### AI Guidelines
- **On-Demand:** AI deal analysis must be explicitly user-triggered to preserve quotas.
- **Propose-Confirm:** AI agents (Co-Pilot) must never modify data without explicit user confirmation.
