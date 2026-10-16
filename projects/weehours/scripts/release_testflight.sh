#!/usr/bin/env bash
# Builds a Release archive of the iOS app (with its widget and watch app) and uploads it to
# App Store Connect for TestFlight.
#
# Signing is automatic via an App Store Connect API key, reusing the certificates already in this
# Mac's keychain (the archive pins the HEJI Apple Development identity by hash, and the export
# re-signs with the existing HEJI Apple Distribution certificate). You need:
#   1. An App Store Connect API key (App Manager or higher) for team 68CTFST8W2.
#   2. The app record in App Store Connect (com.hejitech.weehours) -- this script doesn't create it.
#   3. The on-device models in apps/ios/App/Models (scripts/fetch-models.sh), or the build ships without them.
#
# Usage:
#   APPLE_TEAM_ID=68CTFST8W2 ./scripts/release_testflight.sh
#
# Credentials (first match wins):
#   ASC_KEY_ID    / FA_ASC_KEY_ID     App Store Connect API Key ID
#   ASC_ISSUER_ID / FA_ASC_ISSUER_ID  App Store Connect API Issuer ID
#   ASC_KEY_PATH  / FA_KEY_LOCATION   path to the AuthKey_<KEY_ID>.p8 file
#   APPLE_TEAM_ID                     Apple Developer Team ID (no fallback)
#
# The build number (CFBundleVersion) is the current UTC timestamp, so uploads never collide.
#
# After the upload, `feedbackkit release` marks merged FeedbackKit fixes as shipped in this build so
# reporters get asked "is it fixed?". It needs `npx feedbackkit-cli login` locally or
# FEEDBACKKIT_RELEASE_TOKEN (a project access token with releases:write) in CI; without either it
# only warns, and the upload still counts.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$REPO_ROOT/apps/ios"
BUILD_DIR="$REPO_ROOT/build/release"
ARCHIVE_PATH="$BUILD_DIR/WeeHours.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"
# The archive signs with the existing "Apple Development: Tianhao Zhou (6522A974B3)" (team
# 68CTFST8W2). Xcode 27 rejects a pinned SHA-1 under automatic signing ("conflicting provisioning
# settings"), so the generic "Apple Development" is used and the preflight below requires exactly
# one such identity in the keychain -- headless signing then has nothing to choose between and no
# reason to mint a new certificate. Development, not Distribution, because SPM package targets are
# always signed as development; the export re-signs with the existing Apple Distribution cert.
CODE_SIGN_IDENTITY_SHA1="2CF449D6E3C37D5B9F2E03F601D13A879E96D5A7"

ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}"
ASC_KEY_PATH="${ASC_KEY_PATH:-${FA_KEY_LOCATION:-}}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

# --- Validate credentials ---------------------------------------------------

missing=()
[[ -z "$ASC_KEY_ID" ]] && missing+=("ASC_KEY_ID (or FA_ASC_KEY_ID)")
[[ -z "$ASC_ISSUER_ID" ]] && missing+=("ASC_ISSUER_ID (or FA_ASC_ISSUER_ID)")
[[ -z "$ASC_KEY_PATH" ]] && missing+=("ASC_KEY_PATH (or FA_KEY_LOCATION)")
[[ -z "$APPLE_TEAM_ID" ]] && missing+=("APPLE_TEAM_ID")

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "error: missing required credentials:" >&2
  for m in "${missing[@]}"; do echo "  - $m" >&2; done
  exit 1
fi

if [[ ! -f "$ASC_KEY_PATH" ]]; then
  echo "error: App Store Connect API key not found at: $ASC_KEY_PATH" >&2
  exit 1
fi

identities="$(security find-identity -v -p codesigning)"
for kind in "Apple Development" "Apple Distribution"; do
  if [[ "$(grep -c "\"$kind:" <<<"$identities")" != "1" ]]; then
    echo "error: expected exactly one \"$kind\" identity in the keychain:" >&2
    echo "$identities" >&2
    echo "  Signing could pick the wrong one (or mint a new one). Remove the extras first." >&2
    exit 1
  fi
done
if ! grep -q "$CODE_SIGN_IDENTITY_SHA1" <<<"$identities"; then
  echo "error: the HEJI Apple Development identity ($CODE_SIGN_IDENTITY_SHA1) is not in the keychain." >&2
  echo "  Import it from ~/Credentials (APPLE_DEV_CERT_P12_PATH in hejitech.env) rather than minting a new one." >&2
  exit 1
fi

# --- Preflight: app icons and bundled models --------------------------------

check_app_icon() {
  local iconset="$1"
  local label="$2"
  if ! find "$iconset" -maxdepth 1 -iname "*.png" 2>/dev/null | grep -q .; then
    echo "error: $label has no app icon image yet (only Contents.json is present)." >&2
    echo "  Add a real 1024x1024 icon before releasing: $iconset" >&2
    return 1
  fi
}

icon_ok=true
check_app_icon "$IOS_DIR/App/Resources/Assets.xcassets/AppIcon.appiconset" "The iOS app" || icon_ok=false
check_app_icon "$IOS_DIR/Watch/Assets.xcassets/AppIcon.appiconset" "The watch app" || icon_ok=false
if [[ "$icon_ok" != "true" ]]; then
  exit 1
fi

if [[ ! -s "$IOS_DIR/App/Models/Laya-Q8_0.gguf" || ! -d "$IOS_DIR/App/Models/whisper/openai_whisper-base.en" ]]; then
  echo "error: on-device models are missing from apps/ios/App/Models. Run scripts/fetch-models.sh first," >&2
  echo "  or set ALLOW_NO_MODELS=1 to ship a build that downloads them on first use." >&2
  [[ "${ALLOW_NO_MODELS:-}" == "1" ]] || exit 1
fi

# --- Build ------------------------------------------------------------------

echo "-> Regenerating Xcode project via xcodegen..."
(cd "$IOS_DIR" && xcodegen generate)

BUILD_NUMBER="$(date -u +%Y%m%d%H%M)"
echo "-> Using build number $BUILD_NUMBER (CFBundleVersion)"

mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

echo "-> Archiving App (Release)..."
xcodebuild archive \
  -project "$IOS_DIR/WeeHours.xcodeproj" \
  -scheme App \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  CODE_SIGNING_ALLOWED=YES \
  CODE_SIGNING_REQUIRED=YES \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="Apple Development" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"

cat > "$EXPORT_OPTIONS_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>teamID</key>
	<string>$APPLE_TEAM_ID</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>destination</key>
	<string>upload</string>
</dict>
</plist>
PLIST

echo "-> Exporting and uploading to App Store Connect (TestFlight)..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

echo "✅ Build $BUILD_NUMBER uploaded to App Store Connect."

echo "-> Announcing build $BUILD_NUMBER to FeedbackKit..."
if ! (cd "$REPO_ROOT" && npx -y feedbackkit-cli release --build "$BUILD_NUMBER"); then
  echo "warning: feedbackkit release failed; run it by hand: npx feedbackkit-cli release --build $BUILD_NUMBER" >&2
fi
echo "   It will appear in TestFlight once Apple finishes processing (usually a few minutes)."
