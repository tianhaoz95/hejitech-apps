#!/usr/bin/env bash
# Builds a Release archive of ToddlerCam (with ToddlerCamWatch and its complications embedded) and
# uploads it to App Store Connect for TestFlight. CI runs it from
# .github/workflows/toddlercam-testflight.yml on every toddlercam-v release (scripts/cut_release.sh
# toddlercam) and weekly; don't run it by hand in place of a release.
#
# Signing is automatic through an App Store Connect API key. CI imports the team-wide HEJI
# distribution and development identities first (.github/actions/apple-signing) so
# -allowProvisioningUpdates never mints certificates on an empty keychain.
#
# Credentials (first match wins per line):
#   ASC_KEY_ID     / FA_ASC_KEY_ID      -- App Store Connect API Key ID
#   ASC_ISSUER_ID  / FA_ASC_ISSUER_ID   -- App Store Connect API Issuer ID
#   ASC_KEY_PATH   / FA_KEY_LOCATION    -- path to the AuthKey_<KEY_ID>.p8 file
#   APPLE_TEAM_ID                        -- Apple Developer Team ID
#
# The build number (CFBundleVersion) is the current UTC timestamp, so uploads never collide.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build/release"
ARCHIVE_PATH="$BUILD_DIR/ToddlerCam.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"

ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}"
ASC_KEY_PATH="${ASC_KEY_PATH:-${FA_KEY_LOCATION:-}}"
APPLE_TEAM_ID="${APPLE_TEAM_ID:-}"

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
[[ -f "$ASC_KEY_PATH" ]] || { echo "error: App Store Connect API key not found at: $ASC_KEY_PATH" >&2; exit 1; }

echo "-> Regenerating Xcode project via xcodegen..."
(cd "$PROJECT_DIR" && xcodegen generate)

BUILD_NUMBER="$(date -u +%Y%m%d%H%M)"
echo "-> Using build number $BUILD_NUMBER (CFBundleVersion)"

mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

echo "-> Archiving ToddlerCam (Release, embeds ToddlerCamWatch + complications)..."
xcodebuild archive \
  -project "$PROJECT_DIR/KidsCam.xcodeproj" \
  -scheme KidsCam \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
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
	<key>uploadSymbols</key>
	<true/>
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
echo "   It will appear in TestFlight once Apple finishes processing (usually a few minutes)."
