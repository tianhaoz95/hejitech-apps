#!/usr/bin/env bash
# Archives, exports, and uploads the iOS app to TestFlight via a real
# `xcodebuild -exportArchive`, replacing the ad hoc manual
# archive+ditto+altool workaround used before this script existed.
#
# `xcodebuild -exportArchive` was broken on this machine ("Unknown
# Distribution Error"), root-caused to two real, separate issues in the
# naive archive/export pipeline:
#
#   1. `xcodebuild archive` run directly from the CLI (as opposed to
#      archiving through Xcode's own Organizer) does not populate the
#      archive's `ApplicationProperties` dict in its Info.plist. Every real
#      IDEDistribution export method (App Store, Ad Hoc, etc.) requires that
#      dict to recognize the archive as distributable at all — without it,
#      every method is rejected, leaving zero available methods, which is
#      what actually produces "Unknown Distribution Error" /
#      "expected one {} but found app-store-connect". Fixed by patching the
#      dict onto the archive's Info.plist by hand via PlistBuddy after
#      archiving (see patch_application_properties below).
#   2. The archive's Products/Applications/ contains both the main Contempo
#      app AND a redundant standalone copy of the embedded watchOS companion
#      app (`Contempo Watch App.app`) — a side effect of archiving via CLI
#      rather than Xcode's Organizer. Left in place, `-exportArchive` treats
#      the standalone watch app as its own export root and produces only a
#      "Contempo Watch App.ipa" instead of the real `Contempo.ipa` with the
#      watch app embedded inside it. Fixed by deleting that redundant
#      top-level copy before exporting.
#
# Automatic/cloud code signing was tried and separately fails ("Cloud
# signing permission error" — the App Store Connect API key isn't scoped for
# certificate/profile management). Manual signing works because all four
# needed App Store distribution profiles already exist locally in
# ~/Library/MobileDevice/Provisioning Profiles/ with correct App Groups
# entitlements, so this script maps them explicitly instead.
#
# Usage: ./scripts/ship-ios-testflight.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"

TEAM_ID="68CTFST8W2"
BUNDLE_ID="com.hejitech.contempoapp"
SIGNING_IDENTITY="Apple Distribution: HEJI TECHNOLOGY LLC ($TEAM_ID)"
API_KEY_ID="6YM26CM3R3"
API_ISSUER_ID="b5e4b7d7-be75-481b-8416-3b5dced8c4ab"
API_KEY_PATH="$ROOT_DIR/credentials/AuthKey_${API_KEY_ID}.p8"

ARCHIVE_PATH="Build/Contempo.xcarchive"
EXPORT_PATH="Build/Export"

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

for tool in xcodegen xcodebuild xcrun; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    warn "Could not find $tool on PATH."
    exit 1
  fi
done

if [[ ! -f "$API_KEY_PATH" ]]; then
  warn "App Store Connect API key not found at $API_KEY_PATH."
  exit 1
fi

cd "$IOS_DIR"

MARKETING_VERSION="$(sed -n 's/.*MARKETING_VERSION: *"\{0,1\}\([^"]*\)"\{0,1\}.*/\1/p' project.yml | head -n 1 | tr -d ' ')"
CURRENT_PROJECT_VERSION="$(sed -n 's/.*CURRENT_PROJECT_VERSION: *"\{0,1\}\([^"]*\)"\{0,1\}.*/\1/p' project.yml | head -n 1 | tr -d ' ')"
if [[ -z "$MARKETING_VERSION" || -z "$CURRENT_PROJECT_VERSION" ]]; then
  warn "Could not read MARKETING_VERSION/CURRENT_PROJECT_VERSION from project.yml."
  exit 1
fi
echo "  version $MARKETING_VERSION ($CURRENT_PROJECT_VERSION)"

log "Generating Xcode project with xcodegen..."
xcodegen generate

log "Archiving Contempo (Release)..."
rm -rf "$ARCHIVE_PATH"
xcodebuild archive \
  -project Contempo.xcodeproj \
  -scheme Contempo \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH"

log "Patching archive Info.plist with ApplicationProperties..."
PLIST="$ARCHIVE_PATH/Info.plist"
/usr/libexec/PlistBuddy \
  -c "Add :ApplicationProperties dict" \
  -c "Add :ApplicationProperties:ApplicationPath string Applications/Contempo.app" \
  -c "Add :ApplicationProperties:CFBundleIdentifier string $BUNDLE_ID" \
  -c "Add :ApplicationProperties:CFBundleShortVersionString string $MARKETING_VERSION" \
  -c "Add :ApplicationProperties:CFBundleVersion string $CURRENT_PROJECT_VERSION" \
  -c "Add :ApplicationProperties:SigningIdentity string $SIGNING_IDENTITY" \
  -c "Add :ApplicationProperties:Team string $TEAM_ID" \
  "$PLIST"

log "Removing redundant standalone Watch App product from the archive..."
find "$ARCHIVE_PATH/Products/Applications" -mindepth 1 -maxdepth 1 -name "*.app" ! -name "Contempo.app" -exec rm -rf {} +

log "Writing ExportOptions.plist..."
mkdir -p Build
cat > Build/ExportOptions.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>
    <key>teamID</key>
    <string>$TEAM_ID</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.hejitech.contempoapp</key>
        <string>Contempo AppStore Contempo</string>
        <key>com.hejitech.contempoapp.widgets</key>
        <string>Contempo AppStore ContempoWidgets</string>
        <key>com.hejitech.contempoapp.watchkitapp</key>
        <string>Contempo AppStore ContempoWatchApp</string>
        <key>com.hejitech.contempoapp.watchkitapp.widgets</key>
        <string>Contempo AppStore ContempoWatchWidgets</string>
    </dict>
</dict>
</plist>
EOF

log "Exporting IPA..."
rm -rf "$EXPORT_PATH"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist Build/ExportOptions.plist

IPA_PATH="$EXPORT_PATH/Contempo.ipa"
if [[ ! -f "$IPA_PATH" ]]; then
  warn "Expected $IPA_PATH but it wasn't produced."
  exit 1
fi

log "Uploading to TestFlight..."
API_PRIVATE_KEYS_DIR="$ROOT_DIR/credentials" xcrun altool --upload-app \
  -f "$IPA_PATH" \
  -t ios \
  --apiKey "$API_KEY_ID" \
  --apiIssuer "$API_ISSUER_ID"

log "Done."
