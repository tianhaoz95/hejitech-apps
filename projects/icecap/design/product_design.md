# Design Document: Residential Real Estate Investment Analyzer

## 1. Executive Summary
This document outlines the product design, technical architecture, and implementation plan for a residential real estate investment analysis tool. The product aims to empower real estate investors (both novice and experienced) to quickly and accurately evaluate the profitability of properties. While the initial concept is a Chrome extension integrating with Redfin, this document expands on that vision to ensure a robust, scalable, and highly valuable product.

## 2. Target Audience
*   **Buy-and-Hold Investors (Landlords):** Looking for long-term cash flow, cap rates, and Cash-on-Cash (CoC) return.
*   **House Flippers:** Focused on After Repair Value (ARV), repair costs, holding costs, and short-term ROI.
*   **BRRRR Investors:** (Buy, Rehab, Rent, Refinance, Repeat) Need to calculate both flip metrics and long-term rental metrics simultaneously.
*   **Wholesalers:** Need lightning-fast calculations to determine maximum allowable offers (MAO) to pitch to other investors.

## 3. Problem Statement
Real estate investors currently suffer from a fragmented workflow:
1.  Browsing listings on Zillow, Redfin, or Realtor.com.
2.  Manually copying property data (price, taxes, HOA, sqft) into cumbersome, customized Excel spreadsheets.
3.  Searching external sites for rental estimates (Rentometer, Zillow Rent Zestimate).
4.  Guessing or manually estimating rehab costs and loan parameters.
This process is slow, error-prone, and leads to missed opportunities in a competitive market.

## 4. Product Form & User Experience
### 4.1. The "Wedge": The Chrome Extension
The Chrome extension is the perfect "wedge" or entry point. It brings the calculator directly to the user where they are already shopping.
*   **Supported Sites:** Start with Redfin, then quickly expand to Zillow and Realtor.com to capture the full market.
*   **Core Mechanics:** 
    *   **Content Script:** Extracts the listing price, property taxes, HOA fees, insurance estimates, and property details directly from the DOM.
    *   **Side Panel / Injectable UI:** Instead of a tiny popup, inject a sleek, floating side panel on the listing page.
    *   **Instant Metrics:** Immediately display default Cap Rate, Cash Flow, and CoC Return based on user-predefined loan assumptions (e.g., 20% down, 7% interest).
    *   **Interactive Calculator:** Sliders for down payment, interest rate, vacancy rate, maintenance, and rehab costs that update metrics in real-time.

### 4.2. The "Hub": Real Estate Investment Command Center
The Hub is a standalone web application designed for high-conviction decision-making and long-term portfolio management. It transforms "scraped data" into actionable business intelligence.

#### 4.2.1. Pillar 1: The Comparison Engine
*   **Side-by-Side Matrix:** Multi-property comparison view where listings are columns and financial metrics (Cap Rate, CoC, Total Cash to Close) are rows.
*   **AI Deal Arbiter:** A Gemini-powered feature that analyzes unstructured data across multiple saved listings to rank them by risk-adjusted return.

#### 4.2.2. Pillar 2: Hybrid Conversational Analysis
Icecap combines robust manual controls with a context-aware AI Agent to provide a flexible analysis experience.
*   **The AI Agent (Co-Pilot):** A persistent assistant that can "read" listings and perform bulk adjustments via natural language. **The agent always operates on a "Propose-Confirm" basis; it never modifies user data without an explicit confirmation click.**
*   **Manual Sovereignty:** All features remain fully accessible via traditional UI elements (sliders, inputs, buttons). Users can complete 100% of their investment analysis without ever interacting with the AI Agent.
*   **Bi-Directional Sync:** Changes made via the AI Agent (after confirmation) instantly update the manual UI elements, and manual adjustments provide immediate feedback to the AI context.

...

#### 4.3.5. The AI Agent Sidebar (The "Co-Pilot")
*   **Visual Identity:** A persistent right-hand sidebar with a `Purple-50` background and a "Sparkle" icon to indicate AI presence.
*   **The Confirmation Loop (Safety First):** When the AI triggers a "Function Call" (e.g., to update a budget), it displays a high-contrast **Action Card** in the chat (e.g., "Adjusting rehab budget to $25k based on listing description. [Cancel] [Confirm]").
*   **Action Badges:** After user confirmation, the change is applied to the main UI, which highlights the modified element (e.g., a brief purple glow) to maintain spatial awareness.
*   **Transparency:** The Agent explains its reasoning (e.g., "I'm suggesting this change because the listing mentions 'major foundation repair needed'") so the user can make an informed decision.


#### 4.2.3. Pillar 3: The Investment Vault
*   **Asset Repository:** Secure storage for deal-specific documentation, including inspection reports, contractor bids, and signed lease agreements.
*   **Visual History:** Chronological photo management (Scraped "Before" vs. User-uploaded "After") to track rehab progress and value-add.

#### 4.2.4. Pillar 4: Pro Report Generation
*   **The One-Pager:** Automated generation of high-design PDF "Deal Sheets" for pitching to spouses, partners, or private lenders.
*   **Lender-Ready Exports:** Specific data formatting for DSCR (Debt Service Coverage Ratio) loan applications and bank-ready property summaries.

### 4.3. UI/UX Design Guidelines: "The Icecap Blueprint"

#### 4.3.0. On-Demand AI Principle
To ensure efficient use of AI quotas and minimize unnecessary API costs, **no AI-powered feature shall run automatically.**
*   **Explicit Trigger:** Every AI action (e.g., Listing Summarization, Red Flag Detection, Advanced Rent Estimation) must be initiated by a user click.
*   **Quota Awareness:** The UI should display the user's remaining AI quota prominently before they trigger an analysis.
*   **Deterministic Fallbacks:** Immediate UI feedback (like map badges or basic cash flow) should always use local mathematical heuristics first, with AI used only for "deep dives."

#### 4.3.1. Design Tokens (Brand Identity)
*   **Color Palette:**
    *   **Primary:** `Blue-600 (#2563eb)` — Used for primary actions, logos, and navigational focus.
    *   **Success (Profit):** `Green-600 (#16a34a)` — Used for positive cash flow, high ROI, and "Buy" signals.
    *   **Alert (Loss):** `Red-600 (#dc2626)` — Used for negative cash flow and "Danger" signals.
    *   **AI/Insights:** `Purple-600 (#9333ea)` — Dedicated to Gemini-powered features and probabilistic analysis.
    *   **Backgrounds:** `Gray-50 (#f8fafc)` (Main BG), `White (#ffffff)` (Cards/Containers).
*   **Typography:**
    *   **Headlines:** Sans-serif (Inter/Roboto), Bold (700-900 weight) for metrics.
    *   **Body:** Sans-serif, Regular (400) for labels, Medium (500) for input values.
*   **Radius:** `Rounded-2xl (16px)` for cards, `Rounded-xl (12px)` for buttons and inputs.

#### 4.3.2. Core Components (Extension Sidebar)
*   **The Global Header:** 
    *   **Logo:** Icon + "Icecap" (Bold, 20px).
    *   **Utility Bar:** Grouped icons (Dashboard Link, Auth, Save, Export) in the top-right.
*   **The Strategy Toggle:**
    *   A pill-shaped background (`Gray-200`) containing two segments ("Rental" vs. "Flip").
    *   Active segment: `White` background with `Shadow-sm` and `Blue-600` text.
*   **Input Groups:**
    *   **Price/Rent/ARV:** Large, bold numeric inputs with a bottom-border-only focus state (`Border-b-2 Blue-600`).
    *   **Interactive Sliders:** Thin track (`Gray-200`) with a bold accent thumb (`Blue-600`). Show the current percentage value in a small, bold badge next to the label.
*   **The Result Card (The "Pulse"):**
    *   A full-width, high-contrast container (`Blue-600` background).
    *   Metrics displayed in a 2-column grid.
    *   Primary metrics (Cash Flow/ROI) should be significantly larger (`Text-2xl`) than secondary metrics.

#### 4.3.3. Interaction & Feedback Patterns
*   **The "Scrape" Flow:**
    *   Button: Large, centered, with a `Search` icon. 
    *   State Change: Switch to "Scraping..." with a subtle pulse or spinner while the content script is active.
*   **Real-time Calculation:** Every input change (text or slider) triggers a re-calculation of the Zustand store. The UI must react instantly with no visible delay.
*   **Map Badging:**
    *   Small badges (`Padding 2px 6px`) injected next to native price labels.
    *   Background matches the profit/loss color logic.
    *   Badge should have a `White` border and `Shadow-sm` to pop against complex map backgrounds.
*   **AI Insight Layer:**
    *   Presented in a `Purple-50` box with a `Purple-100` border.
    *   Use a "Sparkles" icon for the button.
    *   Loading state: Use a shimmering skeleton or "Analyzing..." text.

#### 4.3.4. Hub Dashboard Layout
*   **Fixed Sidebar:** 64px width, white background, vertical navigation list.
*   **Stats Strip:** Three large cards at the top showing aggregate portfolio health (Total Value, Net Cashflow, Avg Cap Rate).
*   **Deal Grid:** A vertical stack of "Deal Cards."
    *   Each card: Icon (Home/TrendingUp) -> Address -> Price -> Cashflow Badge -> Actions.
    *   Hover state: Elevation increase (`Shadow-lg`) and a slight border color shift to `Blue-100`.

## 5. Core Features (MVP)
1.  **Auto-Data Extraction:** Scrape price, taxes, HOA, and address from the active listing.
2.  **Rent Estimation Integration:** Pull average rent for the area (via API or basic heuristics initially).
3.  **The "Napkin" Math:** Instant calculation of Cash Flow, Cap Rate, Gross Rent Multiplier (GRM), and 1% Rule.
4.  **Customizable Assumptions:** Global user settings for standard loan terms, closing costs (%), and management fees (%).
5.  **Save/Export:** Save to a local list or export to CSV.
6.  **Mandatory User Accounts:** Unified login via Google to secure data and sync state between the Extension and the Hub.

## 6. Technical Stack
### 6.0. Monorepo Project Structure
```text
icecap/
├── apps/
│   ├── extension/          # Plasmo: The "Wedge" (Chrome Extension)
│   ├── hub/                # Vite: The "Command Center" (Web App)
│   ├── admin/              # Vite: Internal Backend Management Portal
│   ├── landing/            # Vite: Marketing & Growth (icecap.io)
│   ├── legal/              # Static/Vite: Compliance Sites (legal.icecap.io)
│   └── stripe-mock/        # Dev Tool: Local Stripe Simulation & Webhook Tester
├── packages/
│   ├── math/               # Shared Napkin Math engine
│   ├── ui/                 # "The Icecap Blueprint" (Shared Design System)
│   ├── theme/              # Shared Tailwind Configs & Tokens
│   └── types/              # Shared TS Definitions (User, Subscription, Property)
├── firebase/               # Unified Backend
│   ├── functions/          # Cloud Functions (Stripe, AI, Admin hooks)
│   └── hosting/            # Multi-site Hosting Configuration
└── tests/                  # Cross-platform E2E (Scrape -> Sync -> Admin Verify)
```

### 6.1. Frontend (Monorepo Architecture)
Icecap is structured as a **Turborepo-powered monorepo** to ensure maximum code reuse across all user-facing and internal applications.

*   **Apps (`apps/`):**
    *   **Extension:** Plasmo-based Chrome Extension (The "Wedge").
    *   **Hub:** Vite-based dashboard for deal management (The "Command Center"). Hosted at `hub.icecap-platform.web.app`.
    *   **Admin:** Vite-based internal portal for user management and system health. Hosted at `admin.icecap-platform.web.app`.
        *   **Support Ops:** User impersonation mode (read-only), manual AI quota overrides, and subscription status management.
        *   **Scraper Health:** Remote CSS selector management via Firebase Remote Config and a heatmap of failed scraping attempts for rapid triage.
        *   **Promotion & Growth:** Management of Stripe-linked and Internal Free codes with usage attribution tracking.
        *   **System Health Dashboard:** Aggregate view of Cloud Function health, API latencies, and third-party service status.
    *   **Landing:** High-performance marketing site for acquisition. Hosted at `landing.icecap-platform.web.app`.
    *   **Legal:** Static compliance site hosting Privacy Policy and TOS. Hosted at `legal.icecap-platform.web.app`.
    *   **Stripe-Mock:** A lightweight developer utility to simulate Stripe Checkout sessions and trigger local webhooks. Used to verify the real-time Firestore sync logic without hitting the Stripe API.
*   **Shared Packages (`packages/`):**
    *   **Math:** The "Napkin Math" engine. A single source of truth for all financial calculations (Cap Rate, CoC, etc.).
    *   **UI:** "The Icecap Blueprint" component library. Ensures design consistency across all apps.
    *   **Types:** Shared TypeScript definitions for Firestore documents and API contracts.
    *   **Theme:** Shared Tailwind CSS configurations and brand design tokens.

### 6.2. Backend & AI Architecture (The "Brain")
*   **Platform:** Firebase + Vertex AI.
*   **Advanced Agent Capabilities:**
    *   **Google Search Grounding:** Integration with Google Search to verify real-world data (e.g., "What is the current property tax rate in Austin, TX?") and provide cited, up-to-date market information.
    *   **Code Execution (Sandboxed):** The Agent can generate and execute code for high-precision mathematical modeling, complex logical deductions, and multi-year financial forecasting.
    *   **URL Fetching:** Ability to fetch and parse external web content to enrich the property analysis with neighborhood news, market reports, or zoning documents.
*   **GenAI Function Calling:** The Agent is equipped with a library of local "Tools" (e.g., `updateFinancials`, `compareProperties`) that it invokes after user confirmation.
*   **Serverless Execution:** All AI operations and tool invocations are managed via Cloud Functions for security and quota enforcement.


### 6.3. External APIs & Data Sources
*   **AI Analysis:** Gemini API (via Vertex AI SDK) for listing summarization.
*   **Rental Data:** RentCast API or Realty Mole API.
*   **Property Data Fallback:** Zillow API (via RapidAPI).

### 7. Data & Scraping Strategy (The Risk Factor)
Relying purely on DOM scraping is fragile.
*   **Strategy:** 
    1.  Use DOM scraping for immediate, free MVP data extraction.
    2.  Implement robust error handling: Allow manual overrides if selectors fail.
    3.  Long-term: Enrich scraped data using Gemini to parse unstructured text.
*   **Scraper Resilience & Feedback:**
    1.  **Crowdsourced Health:** Include a "Report Broken Scraper" button. Reports are viewable in the **Admin Portal**.
    2.  **Remote Selectors:** Store CSS selectors in a remote Firebase config file for instant updates.

...

### 12. Security & Data Integrity
*   **Data Isolation (Firestore):** Strict **Firestore Security Rules** ensuring user data privacy.
*   **Admin Access:** RBAC (Role-Based Access Control) enforced via Firebase Custom Claims to restrict the **Admin App** to authorized developers only.
*   **Stripe Webhook Security:** Verify `stripe-signature` to prevent unauthorized status changes.
*   **API Protection:** All Gemini calls proxied through Cloud Functions to enforce rate limits and hide keys.

### 13. Mobile Strategy
While the "Wedge" is desktop-only, the **Hub** and **Landing** pages are **Mobile-First**.
*   **Field Use:** Investors pull up the "Comparison Matrix" on smartphones during tours.
*   **PWA Potential:** The Hub is a Progressive Web App (PWA) for rapid "app-like" access.

### 14. Collaboration & Sharing
*   **Shared Workspaces:** Pro Max users invite "Read-Only" partners.
*   **Dynamic Deal Links:** Public-but-obfuscated URLs for sharing analyses with partners or lenders.

### 15. Analytics & Growth
*   **Funnel Tracking:** Use **PostHog** to monitor the path from `Landing Page -> Extension Install -> Stripe Checkout`.
*   **Scraper Health Monitoring:** Admin dashboard tracks failure rates of DOM selectors across different listing sites.

### 16. Legal & Compliance (Web Store Standards)
To comply with Google Chrome Web Store policies, Icecap maintains a dedicated legal presence:
*   **Dedicated Legal Domain:** `legal.icecap-platform.web.app` serves as the permanent home for compliance documents.
*   **Transparency:** Privacy Policy explicitly details that scraping is "User-Triggered" and only occurs on active listing pages.
*   **Data Rights:** A simplified account deletion flow is provided within the Hub and documented in the Privacy Policy.

### 17. Production Infrastructure
*   **Multi-Site Hosting:** Firebase Hosting manages multiple targets under the `icecap-platform.web.app` project:
    *   `landing.icecap-platform.web.app` (Landing/Marketing)
    *   `hub.icecap-platform.web.app` (User Dashboard)
    *   `admin.icecap-platform.web.app` (Internal Management)
    *   `legal.icecap-platform.web.app` (Compliance)
*   **Security (App Check):** Firebase App Check protects Cloud Functions and Firestore from unauthorized bot traffic.

### 18. Serverless Monitoring & Observability
For the initial launch, the system relies exclusively on **Firebase and Google Cloud native tools** to minimize external dependencies.

*   **Execution Monitoring (Firebase/GCP Native):**
    *   **Cloud Logging & Error Reporting:** Real-time tracking of Cloud Function exceptions, timeouts, and Stripe webhook failures via the Google Cloud Console.
    *   **Firebase Performance Monitoring:** Automatic tracking of network request success rates and latencies for RentCast, Stripe, and Vertex AI. 
    *   **Custom Trace Logs:** Implementation of custom `log()` events in Cloud Functions to track AI token usage and function-calling success rates.
*   **Engineering Observability (Optional/Phase 2):**
    *   **Sentry/PostHog:** Integration of specialized error tracking and session replay is deferred to post-launch optimization phases to maintain a lean V1 stack.
*   **Admin Health Portal:** The Admin App serves as the primary human-readable dashboard for these technical metrics, pulling data directly from Firestore and GCP logs to show system status.

### 19. Launch Communication
*   **Hub Message Center:** Trial status, expiration reminders (e.g., "Trial ends in 3 days"), and AI quota alerts will be delivered via an in-app notification center within the Hub dashboard. This centralizes all account-related updates without requiring an external email service for the V1 launch.

### 20. Market Scope
*   **V1 Target:** The initial launch will target the **United States Market** exclusively, focusing on USD currency and US-based listing formats on Redfin, Zillow, and Realtor.com.


## 8. Implementation Plan (Phased Approach)

### Phase 1: The Redfin Proof of Concept (Weeks 1-2)
*   Setup Plasmo/React extension boilerplate.
*   Write content scripts to parse Redfin property pages.
*   Build a simple UI side-panel.
*   Implement core math logic.

### Phase 2: User Persistence & AI Polish (Weeks 3-5)
*   Integrate Firebase Auth and Firestore.
*   Create a "Settings" page for default assumptions.
*   **Implement "AI Deal Summary" using Gemini 1.5 Flash.**
*   Add Rent Estimate API integration via Cloud Functions.

### Phase 3: Expansion & Web Dashboard (Weeks 6-9)
*   Adapt content scripts for Zillow and Realtor.com.
*   Build the standalone web dashboard for portfolio viewing.
*   Beta testing.

## 9. Go-to-Market & Monetization
Icecap utilizes a premium tiered subscription model where users must start a trial or subscribe to use any part of the service.

### 9.1. Subscription Tiers
1.  **Pro ($19/mo - includes 30-day Free Trial):**
    *   **The Complete "Wedge":** Full cross-platform scraping (Redfin, Zillow, Realtor.com).
    *   **Persistence:** Unlimited property saving and real-time sync with the Hub.
    *   **Calculators:** Advanced Rental, Flip, and BRRRR calculators.
    *   **Limited AI Quota:** 50 Gemini Deal Summaries per month.
2.  **Pro Max ($49/mo):**
    *   All Pro features.
    *   **Unlimited AI Quota:** Unlimited Gemini Deal Summaries.
    *   **Priority Support:** Direct line for feature requests and technical help.
    *   **Early Access:** Priority access to new AI models and experimental features.

### 9.2. Implementation Logic (Subscription & Quotas)
*   **Identity:** Firebase Auth `uid` is linked to a **Stripe Customer ID** in Firestore.
*   **Discounts & Promotions:** 
    *   **Stripe-Linked Codes:** Standard Promotion Codes that apply a specific Stripe Coupon (e.g., 20% off) during checkout.
    *   **Icecap-Internal "Free" Codes:** 
        *   **Requirement:** Admin-generated codes that make the service $0/mo forever.
        *   **Flow:** When redeemed, the system initiates a Stripe Checkout session for a **$0 "Promotional Pro" Price**. 
        *   **Security:** This ensures the user **must provide a credit card** (verified by Stripe) but is never actually charged. This removes the need to sync/manage hundreds of individual Coupons in the Stripe Dashboard.
        *   **Bypass:** Unlike standard discounts, these codes are validated against a `promo_codes` collection in Firestore before the Stripe session is even created.
*   **Subscription States:**
    *   `status: 'trialling'`: Full access to Pro features for 30 days.
    *   `status: 'active'`: Regular paid access (Pro or Pro Max).
    *   `status: 'past_due' | 'unpaid'`: Feature access suspended; overlay displayed with "Update Billing" CTA.
*   **Subscription Sync (Webhooks):**
    *   A Firebase Cloud Function listens for Stripe Webhooks (e.g., `customer.subscription.updated`).
    *   This function updates the user's `tier` and `status` in the Firestore `subscriptions` collection in real-time.
*   **Payment Simulation (Development Phase):**
    *   **Stripe Test Mode:** Use Stripe Test API keys and Test Cards (e.g., 4242...) to verify checkout flows without real financial transactions.
    *   **Stripe CLI:** Mandatory use of the Stripe CLI during local development to forward webhooks to local Firebase Cloud Functions (`localhost:5001`). This ensures the "Sync" logic can be tested end-to-end on a developer's machine.
    *   **Mocking:** Use `stripe-mock` for isolated unit testing of the Cloud Functions without hitting Stripe's servers.
*   **Gatekeeping:** The Extension and Hub check for an active `status: 'active'` or `status: 'trialling'` in Firestore before enabling features.
*   **Quota Enforcement:** Gemini API calls are proxied through a Cloud Function that verifies the user's subscription status and `ai_usage_current_month` before execution.

### 9.3. Acquisition Channels
*   **Chrome Web Store SEO:** Target keywords like "Real Estate Calculator" and "Investment Analyzer."
*   **BiggerPockets:** Position the 30-day Pro trial as a "Deal Analysis Sprint" for new investors.
*   **TikTok/Reels:** Show "How to analyze 50 deals in 5 minutes" using the Pro Max unlimited AI.

## 10. Future Roadmap & Creative Ideas
*   **The "Buy Box" Alert:** Users define their criteria (e.g., "Any 3/2 in Austin, TX with >8% Cap Rate"). The extension runs silently and highlights properties in green on the Redfin search grid if they meet the math, before the user even clicks them.
*   **AI Deal Summary:** Use an LLM to read the listing description and highlight red flags (e.g., "needs TLC", "cash only", "foundation issues") and estimate rehab costs based on the description.
## 11. Testing & Validation Strategy (E2E)
To ensure the reliability of the extension's math and the seamless sync with the Hub, a Playwright-based E2E suite is mandatory.

### 11.1. Extension Loading Architecture
Playwright must be configured to launch a persistent Chromium context to load the Manifest V3 extension.
*   **Pathing:** Point Playwright to the built extension directory (e.g., `build/chrome-mv3-dev`).
*   **Context Setup:** Use `chromium.launchPersistentContext` with `--disable-extensions-except` and `--load-extension` flags.
*   **ID Extraction:** Dynamically extract the `extensionId` from the background service worker URL to allow for flexible internal navigation.

### 11.2. Side Panel Simulation
Since browser automation cannot "click" the native Chrome toolbar, the side panel must be tested as a standalone page.
*   **Environment Parity:** Navigate directly to `chrome-extension://${extensionId}/sidepanel.html`.
*   **Viewport Shaping:** Explicitly set the viewport size to **400x800** to mimic the narrow, vertical constraints of a real sidebar. This ensures layout-dependent elements (like flex-wrap) are verified correctly.

### 11.3. Content Script Validation
Automated tests must verify that the content script successfully interacts with 3rd-party DOMs (Redfin/Zillow).
*   **Injection Check:** Navigate to a live listing and wait for specific data attributes (e.g., `[data-icecap-processed="true"]`) to appear.
*   **Badge Verification:** Use regex matching to ensure injected badges contain expected financial signals (e.g., `/[+-]\$/`).

### 11.4. Cross-Platform Sync (The "Golden Path")
The most critical test case verifies that data saved in the "Wedge" appears in the "Hub".
1.  **Step 1:** Open the simulated Side Panel and perform an analysis.
2.  **Step 2:** Click "Save" (ensure the test context is logged into the Firebase Emulator).
3.  **Step 3:** Open the Hub URL (`http://localhost:5173`) in the same browser context.
4.  **Step 4:** Verify the new property appears in the "Saved Deals" list with matching metrics.

### 11.5. Debugging Standards
...
### 11.6. CI/CD & Project Health Monitoring
Continuous monitoring of project health is managed via **GitHub Actions**.
*   **Trigger:** Every Push and Pull Request to `main`.
*   **Virtual Framebuffer (Xvfb):** Used in CI to support the extension's requirement for non-headless Chromium instances.
*   **Environment Parity:** The CI pipeline must boot a local instance of the **Firebase Emulator Suite** and the **Hub Web App** to perform full-cycle E2E tests (Scrape -> Sync -> Verify).
*   **Health Artifacts:** Automated generation of Playwright HTML reports on failure to allow for rapid debugging of DOM-scraping regressions caused by external site updates (Redfin/Zillow).
