# Chrome Web Store Submission Report: Icecap

This report outlines all the information and assets required to publish the **Icecap** Chrome extension on the Google Web Store.

---

## 1. Store Listing Details

| Field | Value / Draft |
| :--- | :--- |
| **Title** | Icecap — Real Estate Investment Analyzer |
| **Short Description** | Analyze real estate deals directly on Redfin, Zillow, and Realtor.com. |
| **Long Description** | **Icecap** is the ultimate tool for real estate investors to perform "Napkin Math" in seconds. Stop switching between tabs and spreadsheets—analyze rental properties, flips, and BRRRR deals directly where you browse listings.<br><br>**Key Features:**<br>• **Instant Analysis:** Automatically scrapes price, taxes, and HOA from Redfin, Zillow, and Realtor.com.<br>• **Rental Metrics:** Calculate Cap Rate, Cash on Cash (CoC) Return, 1% Rule, and Monthly Cash Flow.<br>• **Flip & BRRRR Tools:** Calculate Profit, ROI, MAO (Maximum Allowable Offer), and After-Repair Equity.<br>• **Custom Assumptions:** Set your own default loan interest rates, down payments, and closing costs.<br>• **Sync with Hub:** Save your deals to the Icecap Hub dashboard for deep comparison and portfolio management.<br><br>**Stop over-analyzing and start buying. Download Icecap today.** |
| **Category** | Productivity (or Finance) |
| **Language** | English (United States) |

---

## 2. Privacy & Data Practices

Google requires explicit justification for all permissions and a description of data collection.

### Permissions Justification
*   **`activeTab`**: Used to read property details (price, address) from the current listing page only when the user explicitly clicks "Analyze."
*   **`sidePanel`**: Used to display the analysis interface alongside the listing for a seamless user experience.
*   **`storage`**: Used to persist user-defined default loan assumptions and settings locally on the device.
*   **`host_permissions` (`https://*/*`)**: Required to inject "Quick Estimate" badges on search result map markers across supported platforms. *Note: For the final listing, it is recommended to narrow this to `*://*.redfin.com/*`, `*://*.zillow.com/*`, and `*://*.realtor.com/*` to speed up approval.*

### Data Collection
*   **Personally Identifiable Information (PII):** Name and Email (via Google Sign-In) to sync deals to your account.
*   **Financial Data:** Property analysis calculations you save to your dashboard.
*   **Location Data:** Property addresses extracted from listing pages for the purpose of financial analysis.
*   **Authentication:** Firebase Auth is used for secure login.

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
