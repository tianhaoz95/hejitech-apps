#!/bin/bash

# build-extension-all.sh
# Builds the Icecap extension for all distribution channels and prints release instructions.
#
# Channels:
#   chrome   — Chrome Web Store (chrome-mv3)
#   edge     — Edge Add-ons Store (edge-mv3)
#   safari   — Safari (safari-mv3 build + manual Xcode step required)
#   sideload — Direct ZIP distribution (chrome-mv3 + sideload tag, requires stable manifest key)
#
# Usage:
#   ./scripts/build-extension-all.sh [--skip-safari] [--skip-sideload]

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$REPO_ROOT/apps/extension"
DIST_DIR="$REPO_ROOT/dist/extension"
SKIP_SAFARI=false
SKIP_SIDELOAD=false

for arg in "$@"; do
  case $arg in
    --skip-safari)   SKIP_SAFARI=true ;;
    --skip-sideload) SKIP_SIDELOAD=true ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────

header() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }
ok()     { echo "  ✅  $1"; }
warn()   { echo "  ⚠️   $1"; }
fail()   { echo "  ❌  $1"; }
info()   { echo "  ℹ️   $1"; }

# Strip the 'key' field from manifest.json inside a zip.
# The Chrome/Edge Web Stores forbid the key field; it's only needed for sideload.
strip_manifest_key() {
  local zip_path="$1"
  local tmp_dir
  tmp_dir=$(mktemp -d)
  unzip -q "$zip_path" -d "$tmp_dir"
  node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('${tmp_dir}/manifest.json', 'utf8'));
    delete m.key;
    fs.writeFileSync('${tmp_dir}/manifest.json', JSON.stringify(m, null, 2));
  "
  rm "$zip_path"
  (cd "$tmp_dir" && zip -qr "$zip_path" .)
  rm -rf "$tmp_dir"
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────

header "Pre-flight checks"

# Ensure .env exists in the extension dir (Firebase config required)
if [ ! -f "$EXT_DIR/.env" ]; then
  fail "Missing $EXT_DIR/.env — copy .env.example and fill in Firebase config"
  exit 1
fi
ok ".env found"

# Check for sideload manifest key (needed for stable extension ID)
MANIFEST_KEY=$(node -e "const p=require('$EXT_DIR/package.json'); process.stdout.write(p.manifest?.key || '')" 2>/dev/null)
SIDELOAD_KEY_MISSING=false
if [ -z "$MANIFEST_KEY" ]; then
  SIDELOAD_KEY_MISSING=true
  warn "No manifest.key in apps/extension/package.json — sideload build will have an unstable extension ID."
  warn "Run: openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -outform der | openssl enc -base64 -A"
  warn "Then add the output as \"key\" under \"manifest\" in apps/extension/package.json."
  if [ "$SKIP_SIDELOAD" = false ]; then
    fail "Aborting sideload build to avoid shipping an unstable ID. Use --skip-sideload to skip it, or add the key."
    exit 1
  fi
else
  ok "Manifest key found — sideload will have a stable extension ID"
fi

mkdir -p "$DIST_DIR"
ok "Output directory: $DIST_DIR"

# ── Build: Chrome ─────────────────────────────────────────────────────────────

header "Building: Chrome Web Store (chrome-mv3)"
pnpm --filter @icecap/extension build:chrome
pnpm --filter @icecap/extension package:chrome
CHROME_ZIP="$EXT_DIR/build/chrome-mv3-prod.zip"
if [ -f "$CHROME_ZIP" ]; then
  cp "$CHROME_ZIP" "$DIST_DIR/icecap-chrome.zip"
  strip_manifest_key "$DIST_DIR/icecap-chrome.zip"
  ok "Chrome package → dist/extension/icecap-chrome.zip"
else
  fail "Chrome zip not found at $CHROME_ZIP"
  exit 1
fi

# ── Build: Edge ───────────────────────────────────────────────────────────────

header "Building: Edge Add-ons Store (edge-mv3)"
pnpm --filter @icecap/extension build:edge
pnpm --filter @icecap/extension package:edge
EDGE_ZIP="$EXT_DIR/build/edge-mv3-prod.zip"
if [ -f "$EDGE_ZIP" ]; then
  cp "$EDGE_ZIP" "$DIST_DIR/icecap-edge.zip"
  strip_manifest_key "$DIST_DIR/icecap-edge.zip"
  ok "Edge package → dist/extension/icecap-edge.zip"
else
  fail "Edge zip not found at $EDGE_ZIP"
  exit 1
fi

# ── Build: Safari ─────────────────────────────────────────────────────────────

if [ "$SKIP_SAFARI" = true ]; then
  warn "Skipping Safari build (--skip-safari)"
else
  header "Building: Safari (safari-mv3)"
  info "Note: This produces a raw extension bundle. Xcode post-processing is required before App Store submission."
  pnpm --filter @icecap/extension build:safari
  pnpm --filter @icecap/extension package:safari
  SAFARI_ZIP="$EXT_DIR/build/safari-mv3-prod.zip"
  if [ -f "$SAFARI_ZIP" ]; then
    cp "$SAFARI_ZIP" "$DIST_DIR/icecap-safari-raw.zip"
    ok "Safari raw bundle → dist/extension/icecap-safari-raw.zip (Xcode conversion still needed)"
  else
    fail "Safari zip not found at $SAFARI_ZIP"
    exit 1
  fi
fi

# ── Build: Sideload ───────────────────────────────────────────────────────────

if [ "$SKIP_SIDELOAD" = true ]; then
  warn "Skipping sideload build (--skip-sideload)"
else
  header "Building: Sideload / Direct ZIP (chrome-mv3 + sideload tag)"
  pnpm --filter @icecap/extension build:sideload
  pnpm --filter @icecap/extension package:sideload
  SIDELOAD_ZIP="$EXT_DIR/build/chrome-mv3-sideload.zip"
  if [ -f "$SIDELOAD_ZIP" ]; then
    cp "$SIDELOAD_ZIP" "$DIST_DIR/icecap-sideload.zip"
    ok "Sideload package → dist/extension/icecap-sideload.zip"
  else
    fail "Sideload zip not found at $SIDELOAD_ZIP"
    exit 1
  fi
fi

# ── Release Instructions ──────────────────────────────────────────────────────

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│              🎉  BUILD COMPLETE — RELEASE GUIDE              │"
echo "└─────────────────────────────────────────────────────────────┘"

echo ""
echo "📦  Artifacts in dist/extension/:"
ls -lh "$DIST_DIR"/*.zip 2>/dev/null | awk '{print "    " $NF, "(" $5 ")"}'

# ─── Chrome Web Store ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🟡  CHROME WEB STORE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Upload dist/extension/icecap-chrome.zip"
echo "  3. Note the Extension ID assigned (format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)"
echo "  4. In Firebase Console → Authentication → Settings → Authorized domains:"
echo "       Add: chrome-extension://<CHROME_EXTENSION_ID>"
echo "  5. Submit for review."
echo ""
echo "  📌 CSP (if needed in production): Add to apps/extension/package.json manifest:"
echo "       connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://securetoken.googleapis.com"

# ─── Edge Add-ons ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔵  MICROSOFT EDGE ADD-ONS STORE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Go to https://partner.microsoft.com/en-us/dashboard/microsoftedge"
echo "  2. Upload dist/extension/icecap-edge.zip"
echo "  3. Note the Edge Extension ID assigned."
echo "  4. In Firebase Console → Authentication → Settings → Authorized domains:"
echo "       Add: chrome-extension://<EDGE_EXTENSION_ID>"
echo "       (Edge uses chrome-extension:// scheme even for Edge Add-ons)"
echo "  5. Submit for review."

# ─── Safari ───
if [ "$SKIP_SAFARI" = false ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  🍎  SAFARI (Mac App Store)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ⚠️  IMPORTANT: Safari requires Xcode post-processing. The raw bundle"
  echo "     (icecap-safari-raw.zip) is NOT directly submittable."
  echo ""
  echo "  1. Unzip dist/extension/icecap-safari-raw.zip"
  echo "  2. Convert to Safari Web Extension:"
  echo "       xcrun safari-web-extension-converter ./safari-mv3-prod \\"
  echo "         --project-location ./safari-xcode \\"
  echo "         --app-name 'Icecap' \\"
  echo "         --bundle-identifier com.yourcompany.icecap"
  echo "  3. Open the generated Xcode project, set your team, increment build number."
  echo "  4. Archive → Distribute via App Store Connect."
  echo "  5. In Firebase Console → Authentication → Settings → Authorized domains:"
  echo "       Add: safari-web-extension://<BUNDLE_ID>"
  echo "  ⚠️  NOTE: chrome.sidePanel API is Chrome-specific. Safari compatibility"
  echo "     requires additional platform-gating before submission."
fi

# ─── Sideload ───
if [ "$SKIP_SIDELOAD" = false ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📦  SIDELOAD / DIRECT DISTRIBUTION"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$SIDELOAD_KEY_MISSING" = true ]; then
    echo "  ⚠️  Built WITHOUT a stable manifest key — extension ID will vary per user install."
  else
    echo "  ✅  Built with stable manifest key."
    STABLE_ID=$(node -e "
      const crypto = require('crypto');
      const key = require('$EXT_DIR/package.json').manifest?.key || '';
      // Extension ID is derived from the SHA256 of the public key, first 32 bytes, mapped to a-p
      const buf = Buffer.from(key, 'base64');
      const hash = crypto.createHash('sha256').update(buf).digest();
      const id = Array.from(hash.slice(0,16)).map(b => String.fromCharCode(97 + (b % 16))).join('');
      process.stdout.write(id);
    " 2>/dev/null || echo "<compute manually>")
    echo "  Extension ID: $STABLE_ID"
    echo "  4. In Firebase Console → Authentication → Settings → Authorized domains:"
    echo "       Add: chrome-extension://$STABLE_ID"
  fi
  echo ""
  echo "  1. Share dist/extension/icecap-sideload.zip with users."
  echo "  2. Users unzip, go to chrome://extensions, enable Developer Mode,"
  echo "     click 'Load unpacked', and select the unzipped folder."
  echo "  3. Chrome will show a Developer Mode warning — this is expected."
fi

# ─── Firebase Auth summary ───
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔥  FIREBASE AUTH — AUTHORIZED DOMAINS CHECKLIST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  After uploading to each store, add the following to"
echo "  Firebase Console → Authentication → Settings → Authorized domains:"
echo ""
echo "    chrome-extension://<CHROME_WEB_STORE_ID>"
echo "    chrome-extension://<EDGE_ADD_ONS_ID>"
[ "$SKIP_SAFARI" = false ]   && echo "    safari-web-extension://com.yourcompany.icecap"
[ "$SKIP_SIDELOAD" = false ] && echo "    chrome-extension://<SIDELOAD_STABLE_ID>"
echo ""
echo "  See reports/extension-multi-channel-distribution.md for full details."
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│                      ✅  Done!                               │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
