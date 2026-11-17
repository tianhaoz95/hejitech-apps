# TODO: Firefox Support for Icecap Extension

Currently, the Icecap extension is optimized for Chromium-based browsers (Chrome, Edge, Brave, etc.) using Manifest V3 and the `sidePanel` API. To support Firefox, the following architectural and build changes are required.

## 1. Manifest Compatibility
Firefox uses different keys for some Manifest V3 features.
- [ ] Add `browser_specific_settings` with a `gecko` ID to the manifest.
- [ ] Implement conditional manifest fields for Firefox (e.g., `sidebar_action` vs `side_panel`).

## 2. Sidepanel vs Sidebar
The Chrome `sidePanel` API is not supported in Firefox.
- [ ] Implement a Firefox-compatible sidebar using the `sidebar_action` API.
- [ ] Ensure the React components in `sidepanel.tsx` are generic enough to be reused in the Firefox sidebar.

## 3. Background Scripts
Chrome uses Service Workers, but Firefox support for MV3 Service Workers is still evolving and may require Background Pages as a fallback.
- [ ] Verify if `background.ts` needs a non-service-worker fallback for Firefox.

## 4. Deployment Workflow
- [ ] Update `.github/workflows/deploy-on-release.yml` to include a Firefox build target:
  ```bash
  pnpm --filter @icecap/extension build --target=firefox-mv3
  ```
- [ ] Update `scripts/upload-sideload.mjs` to handle and upload the Firefox ZIP package (e.g., `icecap-extension-firefox.zip`).

## 5. Landing Page
- [ ] Update `apps/landing/src/App.tsx` to point the "Firefox" dropdown option to the new Firebase Storage link once implemented.
