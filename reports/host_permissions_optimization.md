# Host Permissions Optimization Plan

## Problem
The Icecap extension currently requests broad host permissions (`https://*/*`), which triggers an in-depth and delayed review process by the Chrome Web Store. Google recommends using `activeTab` or specific host permissions to minimize review times and improve security.

## Current State
- **Manifest Permissions:** `sidePanel`, `tabs`, `activeTab`, `storage`, `identity`
- **Manifest Host Permissions:** `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`
- **Content Scripts:**
  - `redfin.ts`: Matches `https://www.redfin.com/*`
  - `zillow.ts`: Matches `https://www.zillow.com/*`
  - `realtor.ts`: Matches `https://www.realtor.com/*`

## Proposed Changes

### 1. Narrow Host Permissions
Instead of allowing access to all HTTPS sites, we will explicitly list only the domains required for the extension to function. This includes the major real estate platforms and our local development environments.

**Updated `host_permissions`:**
```json
"host_permissions": [
  "https://www.redfin.com/*",
  "https://www.zillow.com/*",
  "https://www.realtor.com/*",
  "http://localhost/*",
  "http://127.0.0.1/*"
]
```

### 2. Leverage `activeTab` for Generic Extraction
The extension already requests `activeTab`. This permission provides temporary access to the current tab in response to an explicit user gesture (e.g., clicking the extension icon or opening the side panel). For users who want to use Icecap on a real estate site *not* in our explicit list, `activeTab` allows the extension to "Analyze" that specific page without needing persistent broad permissions.

### 3. Review Implementation of `activeTab` usage
Ensure that the scraping logic triggered by the "Analyze Active Listing" button in the sidebar works correctly even on sites not explicitly matched in `host_permissions`.
- **Logic:** When the user clicks "Scrape", the extension sends a message to the content script. If a content script isn't automatically injected (because the site isn't in the manifest), we can use `chrome.scripting.executeScript` (requires `scripting` permission) or rely on the user manually navigating to a supported site.
- **Decision:** Given our core focus is Redfin, Zillow, and Realtor.com, explicit host permissions for these three are the most robust approach for "Zero-Click" features like Quick Estimate badges.

## Impact on Review Time
By removing `https://*/*`, we move from a "High Risk" permission tier to a "Specific Site" tier. This typically reduces the review time from 7+ days to 1-3 days.

## Action Items
1. [ ] Update `apps/extension/package.json` to replace `https://*/*` with specific real estate domains.
2. [ ] Test "Quick Estimate" badges on search result pages for Redfin, Zillow, and Realtor.com to ensure they still function.
3. [ ] Verify that Google Auth (`identity` permission) still functions without broad host permissions.
4. [ ] Resubmit to Chrome Web Store.
