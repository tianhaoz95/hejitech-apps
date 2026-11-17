# Icecap Production Launch Gaps Report

This report identifies critical, essential, and recommended tasks that must be completed before the public launch of the Icecap platform.

---

## 🔴 CRITICAL GAPS (Launch Blockers)

### 1. AI Implementation
- **Missing `propertyChat` Function:** The Chrome extension calls the `propertyChat` Cloud Function, but it is not implemented in `firebase/functions/src/index.ts`. This breaks the "AI Property Assistant" feature in the sidebar.
- **Production `analyzeProperty` Stub:** The Cloud Function for deep property analysis is currently a stub that throws an `unimplemented` error in production. It needs a real integration with Vertex AI (Gemini 1.5 Flash).
- **AI Dependency Missing:** `firebase/functions/package.json` is missing `@google/generative-ai` or equivalent dependencies required for production Gemini calls.
- **AI Service Inconsistency:** The Hub dashboard calls Gemini directly via the client (`firebase/ai`), while the extension uses Cloud Functions. This creates inconsistent safety filtering, token tracking, and quota enforcement.

### 2. Security & Secrets Management
- **Production Credentials:** Transition all apps from emulator-specific stubs and `.env.example` keys to production-grade secrets:
  - Stripe Live Mode Secret Key (`sk_live_...`).
  - Stripe Live Mode Webhook Secret (`whsec_...`).
  - Gemini/Vertex AI project credentials and billing enablement.
  - RentCast Production API Key for reliable rent estimates.
- **Environment Parameterization:** Move hardcoded fallback `apiKey` and other Firebase config values in `core/firebase.ts` fully into CI/CD environment variables.

### 3. Legal & Compliance
- **Live Privacy Policy/TOS:** These documents must be hosted at the final production URLs (e.g., `https://icecap.io/privacy`) and verified for legal accuracy before being submitted to the Chrome Web Store.
- **Narrow Extension Permissions:** The current `host_permissions` (`https://*/*`) in the extension manifest should be restricted to Redfin, Zillow, and Realtor.com domains to minimize review delays and improve security.

---

## 🟡 ESSENTIAL GAPS (High Priority)

### 1. Multi-Browser Support
- **Firefox Implementation:** The extension currently only supports Chromium. A Firefox-specific manifest and "Sidebar" (vs Chrome's Sidepanel) implementation are required.
- **Safari Compatibility:** The Safari build path mentioned in the landing page is not yet implemented or tested.

### 2. Infrastructure & Monitoring
- **Error Tracking:** Implement a production error tracking service (e.g., **Sentry**) across the Extension, Hub, and Cloud Functions to detect failures in the wild.
- **Scraper Health Monitoring:** Implement the "Scraper Failure Heatmap" in the Admin portal to proactively detect when Redfin/Zillow change their DOM structure.
- **Usage Analytics:** Integrate Google Analytics or Mixpanel to track user conversion funnels from the landing page to the extension install.

### 3. Product Content
- **Landing Page Polish:** Replace all `localhost` and placeholder links (`#`) with production URLs.
- **Testimonials:** Replace placeholder testimonials on the landing page with real user feedback or "Beta User" quotes.
- **Marketing Assets:** Generate missing extension icons (16x16, 48x48) and final marketing screenshots using the Playwright screenshot tool.

---

## 🟢 RECOMMENDED (Post-Launch/Polish)

### 1. Technical Debt
- **Unify Math Logic:** Resolve the code duplication between `packages/math` and `apps/extension/src/core/math.ts`. The extension should ideally consume the shared package to prevent divergent financial logic.
- **Type Safety Cleanup:** Address the 16+ TypeScript errors (mostly unused imports and implicit `any` types) found during production build checks.

### 2. Feature Enhancements
- **Shared Workspaces:** Mentioned as "coming soon" in the pricing section; need a clear roadmap if this is to be part of the "Pro Max" value proposition.
- **Mobile App:** The landing page implies a "mobile-first design" for the Hub, but a dedicated PWA (Progressive Web App) manifest would improve the experience on iOS/Android.

---

## 📋 Administrative Checklist
- [ ] Register Chrome Web Store Developer account ($5 fee).
- [ ] Enable 2FA on all administrative Google/Stripe accounts.
- [ ] Set up "Non-trader" or "Trader" status in the Chrome Web Store dashboard.
- [ ] Configure production domain (`icecap.io`) in Firebase Hosting and Stripe.
