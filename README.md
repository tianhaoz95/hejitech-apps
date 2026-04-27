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
- Stripe CLI (Optional, for local webhook testing)

### Installation & Build
```bash
# Install dependencies
pnpm install

# Build all packages and applications
pnpm turbo run build
```

---

## 🛠️ Local Development & Testing

Icecap relies on the local Firebase Emulator and Stripe CLI for full-cycle testing.

### 1. Start the Environment
You can start the emulator, Stripe CLI listener, and all dev servers with a single command:

```bash
pnpm run dev:all
```

### 2. Seed Test Data
Populate the emulator with test users, subscriptions, and sample properties:

```bash
pnpm run emulator:seed
```

### 3. Local AI Development (Gemini Nano)
To test AI features locally without cloud costs, Icecap uses **Firebase AI Logic** with Chrome's built-in **Gemini Nano** model.

**Setup Instructions:**
1.  **Enable Gemini Nano:**
    *   Open `chrome://flags/` in your browser.
    *   Search for `#optimization-guide-on-device-model` and set it to **Enabled BypassPerfRequirement** (Critical).
    *   Search for `#prompt-api-for-gemini-nano` and set it to **Enabled**.
    *   Relaunch Chrome.
2.  **Verify Setup:**
    *   Open DevTools (F12) and type:
      ```javascript
      await LanguageModel.availability()
      ```
    *   It should return `"available"`.
    *   *Note:* In Chrome v131+, the API is available via the global `LanguageModel` (or `ai.languageModel`) object.
3.  **Troubleshooting `ReferenceError` / `undefined`:**
    *   **Check Components:** Go to `chrome://components`. Find **Optimization Guide On Device Model**. If version is `0.0.0.0`, click **Check for update** and wait for the ~1.5GB download.
    *   **Disk Space:** You must have at least **22GB of free space**. Chrome will silently disable the API if space is low.
    *   **Internal State:** Check `chrome://on-device-internals`. The Foundational Model should be `Ready`.
4.  **Local Inference:**
    *   When running with the emulator, the `firebase/ai` SDK (used in the Hub and soon in the Extension) will automatically detect Gemini Nano and perform inference locally on your device.

### 4. Run Applications
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
Comprehensive browser automation (Extension -> Sync -> Hub). **Requires the Emulator to be running.**
```bash
# Run all E2E tests (automatically manages environment)
pnpm run test:e2e
```

### Automated Store Screenshots
Capture high-resolution screenshots for the Chrome Web Store listing using Playwright:
```bash
# 1. Build the extension
pnpm --filter @icecap/extension build:prod

# 2. Run capture script (requires emulator to be running)
pnpm --filter @icecap/tests playwright test tests/screenshots.spec.ts --project=extension
```
Screenshots are saved to `reports/screenshots/`.

---

## 🔑 Environment Variables

Each application has a `.env.example` file. Copy these to `.env` and fill in the required values (placeholders are pre-filled for emulator use).

- `firebase/functions/.env.example`
- `apps/extension/.env.example`
- `apps/hub/.env.example`
- `apps/admin/.env.example`

## 🛒 Chrome Web Store Listing

This information is used for the official extension listing.

**Title:** `Icecap — Real Estate Investment Analyzer`  
**Short Description:** `Analyze real estate deals on your favorite sites.`

**Long Description:**
> **Icecap** is the ultimate real estate investment co-pilot for serious investors. Stop wasting time switching between listing sites, manual spreadsheets, and complex calculators. Icecap brings the power of professional financial analysis directly to your browser, allowing you to perform "Napkin Math" in seconds on your favorite listing sites.
>
> **Why install Icecap?**
> Finding the right deal is a numbers game. To win, you need to analyze properties faster and more accurately than the competition. Icecap eliminates the friction of manual data entry by automatically extracting key property data—including price, taxes, and HOA fees—and instantly calculating the metrics that matter most to your bottom line.
>
> **Key Features:**
> - **Instant On-Site Analysis:** Scrape and analyze properties in one click directly on Redfin, Zillow, and Realtor.com.
> - **Professional Rental Metrics:** Instantly see your Cap Rate, Cash on Cash (CoC) Return, 1% Rule compliance, and Monthly Cash Flow.
> - **Advanced Flip & BRRRR Tools:** Evaluate rehab projects with automated calculations for Profit, ROI, and the 70% Rule (MAO).
> - **AI-Powered Deal Summaries:** Get an instant second opinion. Our AI analyzes listing descriptions to highlight potential red flags and investment opportunities.
> - **Customizable Assumptions:** Tailor the math to your strategy by setting default interest rates, down payments, and closing costs.
> - **Seamless Hub Integration:** Save your top picks to the Icecap Hub for deep comparison, portfolio tracking, and permanent storage.
>
> **Stop over-analyzing and start buying with confidence. Download Icecap today and turn your browser into a high-speed deal machine.**

---

## 📜 License
Private/Proprietary — Icecap Platform V1
