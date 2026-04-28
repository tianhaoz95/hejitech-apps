# Chrome Web Store Rejection Analysis: Error 400 (redirect_uri_mismatch)

## 📋 Rejection Overview
The Icecap extension was rejected by the Chrome Web Store review team due to a non-functional feature: **Authentication**. Specifically, the reviewer encountered an `Error 400: redirect_uri_mismatch` when attempting to sign in with Google.

*   **Item ID:** `gbjiibgccfkpodffchmnokflclbnbfpl`
*   **Violation ID:** `Red Potassium`
*   **Root Cause:** A mismatch between the Extension ID used in the Google OAuth configuration and the actual ID assigned by the Chrome Web Store.

---

## 🔍 Root Cause Analysis

The extension uses `chrome.identity.launchWebAuthFlow` for authentication. This API generates a redirect URI based on the extension's ID using `chrome.identity.getRedirectURL()`. 

1.  **Sideload/Development ID (`cljkjphaofjfagcekpbnkonpepdcciba`):** This ID is derived from the `key` field in `apps/extension/package.json`. It is used during local development and for "sideloaded" versions (e.g., when testers install the zip manually).
2.  **Web Store Production ID (`gbjiibgccfkpodffchmnokflclbnbfpl`):** This is the ID assigned by the Chrome Web Store for the official listing. When the reviewer (or a user from the store) installs the extension, this is the ID Chrome sees.
3.  **The Failure:** The Google OAuth configuration was only set up for the Sideload ID. When the reviewer clicked "Sign In" on the Web Store version, the extension sent a `redirect_uri` of `https://gbjiibgccfkpodffchmnokflclbnbfpl.chromiumapp.org/`, which was not registered.

---

## 🛠️ Implementation Plan

To fix this, we must ensure **both** IDs are registered in the Google Cloud and Firebase consoles. This allows authentication to work for both developers and official users.

### 1. Update Google Cloud Console
1.  Go to the [Google Cloud Console Credentials page](https://console.cloud.google.com/apis/credentials).
2.  Locate the **OAuth 2.0 Client ID** used for production.
3.  Under **Authorized redirect URIs**, ensure **both** of the following are present:
    ```
    https://cljkjphaofjfagcekpbnkonpepdcciba.chromiumapp.org/
    https://gbjiibgccfkpodffchmnokflclbnbfpl.chromiumapp.org/
    ```
4.  Save the changes.

### 2. Update Firebase Console
1.  Go to the [Firebase Console Authentication Settings](https://console.firebase.google.com/project/icecap-platform/authentication/settings).
2.  Navigate to the **Authorized domains** tab.
3.  Ensure **both** domains are added:
    ```
    cljkjphaofjfagcekpbnkonpepdcciba.chromiumapp.org
    gbjiibgccfkpodffchmnokflclbnbfpl.chromiumapp.org
    ```
4.  Click **Add**.

### 3. Update Internal Documentation
I will update `reports/TODO_PROD_AUTH.md` and `.env.example` in this workspace to reflect the correct production ID to prevent future confusion.

---

## 🧪 Testing Approach & Success Criteria

### Verification Steps (Pre-Submission)
Since the production ID is now known, you can verify the fix using a "Production-like" build:
1.  **Sideload the Production Build:** Build the extension locally using the production key found in `apps/extension/package.json`.
2.  **Verify ID:** Ensure the extension ID in `chrome://extensions` is `gbjiibgccfkpodffchmnokflclbnbfpl`.
3.  **Test Auth Flow:** Open the extension sidepanel and click "Sign In". 
    *   **Success:** The Google sign-in window appears, allows account selection, and successfully returns to the extension.
    *   **Failure:** The window shows "Error 400: redirect_uri_mismatch".

### Success Criteria
- [ ] Google OAuth screen loads without "redirect_uri_mismatch" error.
- [ ] User can successfully authenticate and see their deal dashboard.
- [ ] The extension ID `gbjiibgccfkpodffchmnokflclbnbfpl` is the only one used in production OAuth/Firebase settings.

---

## 🚀 Next Steps
1.  **Apply Console Changes:** Manually update the Google Cloud and Firebase consoles as described above.
2.  **Resubmit:** Once the console changes are saved (allow ~5-10 mins for propagation), resubmit the item for review in the Chrome Web Store Developer Dashboard.
3.  **Appeal/Comment:** When resubmitting, you may add a note to the reviewer stating that the OAuth redirect URIs have been updated to match the production Extension ID.
