# Icecap — Residential Real Estate Investment Analyzer

Icecap is a comprehensive real estate investment analysis platform. It features a Chrome extension ("The Wedge") for instant on-site property analysis on Redfin, Zillow, and Realtor.com, and a web dashboard ("The Hub") for portfolio management and deep financial insights.

## 🏗️ Monorepo Architecture

This project is a Turborepo-powered monorepo:

### Apps (`apps/`)
- **extension**: Chrome extension built with Plasmo, React, and Zustand.
- **hub**: Standalone web application for deal management and portfolio tracking.
- **admin**: Internal portal for user management, system health, and scraper monitoring.
- **landing**: Marketing site for user acquisition.
- **legal**: Static site hosting Privacy Policy and Terms of Service.
- **stripe-mock**: Local developer utility to simulate Stripe Checkout and Webhooks.

### Packages (`packages/`)
- **math**: The "Napkin Math" engine — shared financial logic (Cap Rate, CoC, etc.).
- **ui**: "The Icecap Blueprint" shared React component library.
- **theme**: Shared Tailwind CSS tokens and brand configuration.
- **types**: Shared TypeScript definitions and API contracts.

### Infrastructure
- **firebase**: Unified backend with Firestore rules, Cloud Functions, and Hosting.
- **tests**: Cross-platform End-to-End (E2E) tests using Playwright.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- pnpm >= 9
- Firebase CLI (`npm install -g firebase-tools`)

### Installation & Build
```bash
# Install dependencies
pnpm install

# Build all packages and applications
pnpm turbo run build
```

---

## 🛠️ Local Development & Testing

Icecap relies on a local Firebase Emulator and a Stripe Mock server for full-cycle testing without external dependencies.

### 1. Start the Environment
You can start everything (emulator, stripe-mock, and dev servers) with a single command:

```bash
pnpm run dev:all
```

Alternatively, start them separately in different terminal windows:

### 2. Seed Test Data
Populate the emulator with test users, subscriptions, and sample properties:

```bash
pnpm run emulator:seed
```

### 3. Run Applications
```bash
# Run all applications in development mode
pnpm dev

# Or run specific apps
pnpm dev:hub
pnpm dev:extension
pnpm dev:admin
```

---

## 🧪 Testing Strategy

Verification is mandatory for every PR.

### Unit Tests
Focused on the core financial math engine.
```bash
pnpm turbo run test --filter=@icecap/math
```

### End-to-End (E2E) Tests
Comprehensive browser automation (Extension -> Sync -> Hub). **Requires the Emulator and Stripe Mock to be running.**
```bash
# Run all E2E tests
pnpm --filter @icecap/tests test

# Run a specific test suite
pnpm --filter @icecap/tests run test:golden
pnpm --filter @icecap/tests run test:extension
```

---

## 🔑 Environment Variables

Each application has a `.env.example` file. Copy these to `.env` and fill in the required values (placeholders are pre-filled for emulator use).

- `firebase/functions/.env.example`
- `apps/extension/.env.example`
- `apps/hub/.env.example`
- `apps/admin/.env.example`

---

## 📜 License
Private/Proprietary — Icecap Platform V1
