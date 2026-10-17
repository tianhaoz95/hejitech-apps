#!/usr/bin/env bash
# Builds a Release archive of the iOS app (with its widgets and watch app) and uploads it to App
# Store Connect for TestFlight. Run by contempo-testflight.yml when scripts/cut_release.sh contempo
# publishes a contempo-v<version> release; same shape as Wee Hours' release_testflight.sh.
#
# Signing is automatic via an App Store Connect API key, reusing the team's existing certificates
# (the HEJI Apple Development identity for the archive, Apple Distribution for the export). The
# preflight requires exactly one of each in the keychain so signing never mints a new one.
#
# Needs:
#   1. ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH (or FA_ASC_KEY_ID / FA_ASC_ISSUER_ID / FA_KEY_LOCATION)
#      and APPLE_TEAM_ID.
#   2. The bundled model in ios/Contempo/Resources/Models (scripts/fetch-models.sh), or the build
#      parses with the rule-based fallback until the user downloads the large model.
#
# NO_UPLOAD=1 archives and exports an .ipa into build/release/export without uploading (a local check).
# The build number (CFBundleVersion) is the current UTC timestamp (builds before the monorepo were
# 1…86, so timestamps always sort after them).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IOS_DIR="$REPO_ROOT/ios"
BUILD_DIR="$REPO_ROOT/build/release"
ARCHIVE_PATH="$BUILD_DIR/Contempo.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"
EXPORT_OPTIONS_PLIST="$BUILD_DIR/ExportOptions.plist"
BUNDLE_ID="com.hejitech.contempoapp"
# The HEJI "Apple Development: Tianhao Zhou (6522A974B3)" identity (see Wee Hours' script for why
# the generic name is passed and the hash only checked).
CODE_SIGN_IDENTITY_SHA1="2CF449D6E3C37D5B9F2E03F601D13A879E96D5A7"

ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}"
ASC_KEY_PATH="${ASC_KEY_PATH:-$(eval echo "${FA_KEY_LOCATION:-}")}"
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
  exit 1
fi

if [[ ! -s "$IOS_DIR/Contempo/Resources/Models/Qwen3-0.6B.litertlm" ]]; then
  echo "error: the bundled model is missing from ios/Contempo/Resources/Models. Run scripts/fetch-models.sh," >&2
  echo "  or set ALLOW_NO_MODELS=1 to ship a build that parses with rules until the large model is downloaded." >&2
  [[ "${ALLOW_NO_MODELS:-}" == "1" ]] || exit 1
fi

echo "-> Regenerating Xcode project via xcodegen..."
(cd "$IOS_DIR" && xcodegen generate)

BUILD_NUMBER="$(date -u +%Y%m%d%H%M)"
MARKETING_VERSION="$(sed -nE 's/^[[:space:]]*MARKETING_VERSION:[[:space:]]*"?([0-9.]+)"?.*/\1/p' "$IOS_DIR/project.yml" | head -1)"
echo "-> Version $MARKETING_VERSION ($BUILD_NUMBER)"

mkdir -p "$BUILD_DIR"
rm -rf "$ARCHIVE_PATH" "$EXPORT_PATH"

# project.yml's Release config pins manual signing with the old local App Store profiles; the
# overrides switch every target to automatic signing with the API key instead.
echo "-> Archiving Contempo (Release)..."
xcodebuild archive \
  -project "$IOS_DIR/Contempo.xcodeproj" \
  -scheme Contempo \
  -configuration Release \
  -archivePath "$ARCHIVE_PATH" \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  -destination "generic/platform=iOS" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" \
  CODE_SIGNING_ALLOWED=YES \
  CODE_SIGNING_REQUIRED=YES \
  CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_IDENTITY="Apple Development" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER"

# Two quirks of CLI archives of this app (found before the monorepo, scripts/ship-ios-testflight.sh):
# the archive may lack ApplicationProperties (export then finds no distribution method), and it
# carries a redundant top-level copy of the watch app (export would produce only that .ipa).
PLIST="$ARCHIVE_PATH/Info.plist"
if ! /usr/libexec/PlistBuddy -c "Print :ApplicationProperties" "$PLIST" >/dev/null 2>&1; then
  echo "-> Adding ApplicationProperties to the archive..."
  /usr/libexec/PlistBuddy \
    -c "Add :ApplicationProperties dict" \
    -c "Add :ApplicationProperties:ApplicationPath string Applications/Contempo.app" \
    -c "Add :ApplicationProperties:CFBundleIdentifier string $BUNDLE_ID" \
    -c "Add :ApplicationProperties:CFBundleShortVersionString string $MARKETING_VERSION" \
    -c "Add :ApplicationProperties:CFBundleVersion string $BUILD_NUMBER" \
    -c "Add :ApplicationProperties:Team string $APPLE_TEAM_ID" \
    "$PLIST"
fi
find "$ARCHIVE_PATH/Products/Applications" -mindepth 1 -maxdepth 1 -name "*.app" ! -name "Contempo.app" -exec rm -rf {} +

DESTINATION="upload"
[[ "${NO_UPLOAD:-}" == "1" ]] && DESTINATION="export"
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
	<string>$DESTINATION</string>
</dict>
</plist>
PLIST

echo "-> Exporting ($DESTINATION)..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" \
  -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

if [[ "$DESTINATION" == "export" ]]; then
  ls -la "$EXPORT_PATH"
  echo "✅ Exported build $BUILD_NUMBER (not uploaded)."
else
  echo "✅ Build $BUILD_NUMBER uploaded to App Store Connect. It appears in TestFlight once Apple finishes processing."
fi
