# Chrome Web Store Submission Report: Icecap

This report outlines all the information and assets required to publish the **Icecap** Chrome extension on the Google Web Store.

---

## 1. Store Listing Details

| Field | Value / Draft |
| :--- | :--- |
| **Title** | Icecap — Real Estate Investment Analyzer |
| **Short Description** | Analyze real estate deals on your favorite sites. |
| **Single Purpose** | Icecap provides instant financial analysis and "Napkin Math" metrics for real estate listings directly on residential real estate websites. |
| **Long Description** | **Icecap** is the ultimate real estate investment co-pilot for serious investors. Stop wasting time switching between listing sites, manual spreadsheets, and complex calculators. Icecap brings the power of professional financial analysis directly to your browser, allowing you to perform "Napkin Math" in seconds on your favorite listing sites.<br><br>**Why install Icecap?**<br>Finding the right deal is a numbers game. To win, you need to analyze properties faster and more accurately than the competition. Icecap eliminates the friction of manual data entry by automatically extracting key property data—including price, taxes, and HOA fees—and instantly calculating the metrics that matter most to your bottom line.<br><br>**Key Features:**<br>• **Instant On-Site Analysis:** Scrape and analyze properties in one click directly on Redfin, Zillow, and Realtor.com.<br>• **Professional Rental Metrics:** Instantly see your Cap Rate, Cash on Cash (CoC) Return, 1% Rule compliance, and Monthly Cash Flow.<br>• **Advanced Flip & BRRRR Tools:** Evaluate rehab projects with automated calculations for Profit, ROI, and the 70% Rule (MAO).<br>• **AI-Powered Deal Summaries:** Get an instant second opinion. Our AI analyzes listing descriptions to highlight potential red flags and investment opportunities.<br>• **Customizable Assumptions:** Tailor the math to your strategy by setting default interest rates, down payments, and closing costs.<br>• **Seamless Hub Integration:** Save your top picks to the Icecap Hub for deep comparison, portfolio tracking, and permanent storage.<br><br>**Stop over-analyzing and start buying with confidence. Download Icecap today and turn your browser into a high-speed deal machine.** |
| **Category** | Productivity (or Finance) |
| **Language** | English (United States) |

---

## 2. Privacy & Data Practices

Google requires explicit justification for all permissions and a description of data collection.

### Permissions Justification

Google requires explicit justification for all permissions. Icecap uses a minimal set of permissions to provide its core functionality:

*   **`sidePanel`**: Used to display the financial calculator and AI analysis interface side-by-side with property listings. This allows users to see the analysis without losing context of the listing.
*   **`activeTab`**: Used to securely extract property details (price, address, taxes, HOA) from the current listing page only when the user explicitly triggers an analysis.
*   **`tabs`**: Required to open the Icecap Hub dashboard in a new browser tab and to detect navigation on supported real estate websites to ensure the sidebar stays in sync with the active listing.
*   **`storage`**: Used to persist user-defined investment assumptions (default interest rates, down payments, closing costs) locally on the device for a personalized experience.
*   **`identity`**: Enables secure, one-click sign-in via Google OAuth. This is essential for identifying the user and syncing their saved deals to the Icecap Hub backend.
*   **`host_permissions` (`https://*/*`)**: Required to identify and extract data from supported real estate platforms (Redfin, Zillow, Realtor.com). This permission is also used to inject "Quick Estimate" badges onto search result map markers. *Note: We narrow this scope to specific real estate domains in the final manifest to ensure the principle of least privilege.*

### Remote Code Usage

**Question:** Are you using remote code?  
**Answer:** **No.**

**Justification:** All logic, dependencies, and assets are bundled locally within the extension package at build time. Icecap does not use `eval()`, `new Function()`, or any remotely hosted scripts. All communication with our backend (Firebase) is performed using standard, audited SDKs via HTTPS, ensuring full compliance with Manifest V3 security policies.

### Data Usage Disclosures

By publishing this item, we certify that these disclosures reflect the most up-to-date content of our privacy policy. Below are the data types collected and their justifications:

*   **Personally identifiable information:** **Yes.** We collect your Name and Email address via Google Sign-In. This is used solely to identify your account and synchronize your saved property analyses across the Icecap Hub and Extension.
*   **Health information:** **No.**
*   **Financial and payment information:** **Yes.** We collect the property financial metrics you calculate (e.g., Cap Rate, Cash-on-Cash Return) and your subscription status. We do **not** collect or store credit card numbers; all payments are handled securely via Stripe.
*   **Authentication information:** **Yes.** We use authentication tokens (via Firebase/Google OAuth) to provide secure access to your saved data.
*   **Personal communications:** **No.**
*   **Location:** **Yes.** We extract the property address from listing pages you analyze to provide localized financial context. We do **not** collect your device's GPS coordinates or IP-based location for tracking.
*   **Web history:** **No.** We do not track the list of pages you visit. We only interact with the specific real estate listing page you are actively viewing when you trigger an analysis.
*   **User activity:** **No.** We do not perform network monitoring, click-stream tracking, or keystroke logging.
*   **Website content:** **Yes.** We extract property-specific text (descriptions, price, and features) from real estate listing sites to perform financial calculations and generate AI summaries.

### Privacy Policy
*   **URL:** `https://icecap.io/privacy` (Ensure this is live before submission).
*   **Support Email:** `privacy@icecap.io` or `support@icecap.io`.

---

## 3. Visual Assets Checklist

Google has strict requirements for asset dimensions.

| Asset Type | Dimension | Status |
| :--- | :--- | :--- |
| **Icon (Small)** | 16x16 | ⚠️ Need to generate |
| **Icon (Management)**| 48x48 | ⚠️ Need to generate |
| **Icon (Store)** | 128x128 | ✅ `icon.png` exists (verify 128x128) |
| **Screenshot 1** | 1280x800 | ⚠️ Need to capture (Rental Analysis) |
| **Screenshot 2** | 1280x800 | ⚠️ Need to capture (Flip/BRRRR Analysis) |
| **Screenshot 3** | 1280x800 | ⚠️ Need to capture (Sync to Hub) |
| **Screenshot 4** | 1280x800 | ✅ Captured (AI Chat) |
| **Promo Tile (Small)**| 440x280 | ⚠️ Mandatory for "Featured" |
| **Promo Tile (Large)**| 920x680 | ⚠️ Optional but recommended |
| Marquee Tile | 1400x560 | ⚠️ Optional |

---

## 4. Automated Screenshot Generation

You can automatically capture high-quality screenshots using the existing Playwright infrastructure.

### Prerequisites
1. **Build the extension:**
   ```bash
   pnpm --filter @icecap/extension build:prod
   ```
2. **Start the Firebase Emulator:** (Required for auth/data)
   ```bash
   pnpm run emulator
   ```

### Running the Screenshot Script
A dedicated Playwright test has been created to capture consistent, high-resolution (Retina 2x) screenshots for the store:

```bash
# From the project root
pnpm --filter @icecap/tests playwright test tests/screenshots.spec.ts --project=extension
```

**Output Location:** `reports/screenshots/`
* `extension_login.png`: The welcome/auth screen.
* `extension_rental_analysis.png`: The calculator in Rental mode with active metrics.
* `extension_flip_analysis.png`: The calculator in Flip mode with MAO results.
* `extension_ai_chat.png`: The AI Property Assistant chat interface.

---

## 5. Administrative Requirements

1.  **Developer Account:** Register at [Google Play Console / Chrome Web Store Dashboard](https://chrome.google.com/webstore/devconsole).
    *   One-time **$5 USD** fee.
    *   Enable **Two-Factor Authentication (2FA)**.
2.  **Trader Status (EU):** 
    *   Select **Non-trader** if you are an individual developer not selling physical goods or regulated services.
    *   Select **Trader** if you are a registered business (requires address and phone number to be public).
3.  **Payment Info:** If charging for subscriptions (Icecap Pro), your Stripe integration is already in place, but you must link it to your domain.

---

## 5. Technical Readiness (Checklist)

*   [x] **Manifest V3:** The project is already using Plasmo with MV3.
*   [ ] **Single Purpose:** The extension focuses solely on real estate investment analysis (Compliant).
*   [ ] **Remote Code:** No remotely hosted scripts are used (Compliant).
*   [ ] **HTTPS:** All API calls (Firebase/Cloud Functions) use TLS/SSL.
*   [ ] **Package Size:** Ensure `pnpm run build` is run to produce the `build/chrome-mv3-prod.zip` package.

---

## 6. Submission Workflow

1.  **Build:** Run `pnpm --filter @icecap/extension build:prod` to generate the production bundle.
2.  **Zip:** Use `pnpm --filter @icecap/extension package` (if using Plasmo's package script) or zip the `dist` folder.
3.  **Upload:** Upload the ZIP file to the Developer Dashboard.
4.  **Fill Metadata:** Paste the descriptions and upload the assets listed above.
5.  **Submit for Review:** Initial review typically takes **3–7 days**.
