#!/usr/bin/env bash
# Builds and installs the "prod" (Release configuration) iOS app onto an iOS
# simulator or connected physical device — real Firebase (contempo-platform),
# real Google Sign-In, no emulator wiring. Unlike
# scripts/run-ios-with-emulators.sh, this never starts or touches the
# Firebase emulator suite.
#
# If a watchOS simulator or device is available, the watchOS companion app is
# built and installed on it too, same Release configuration. This is
# best-effort: no watch device found is not an error, it's the normal case for
# anyone not also testing the watch app.
#
# Usage: ./scripts/install-ios-prod.sh [--no-launch] [--ios] [--watch-os|--watchOS|--watch]
#   --no-launch: build and install only, skip launching too.
#   --ios:       only install the iOS phone app, skip the watch app.
#   --watch-os:  only install the watchOS companion app, skip the phone app.
#   Passing neither (or both) installs both, which is the default.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"

LAUNCH=true
INSTALL_IOS=true
INSTALL_WATCH=true
WANT_IOS_ONLY=false
WANT_WATCH_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --no-launch) LAUNCH=false ;;
    --ios) WANT_IOS_ONLY=true ;;
    --watch-os|--watchOS|--watch) WANT_WATCH_ONLY=true ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--no-launch] [--ios] [--watch-os|--watchOS|--watch]" >&2
      exit 1
      ;;
  esac
done

if [[ "$WANT_IOS_ONLY" == "true" ]] && [[ "$WANT_WATCH_ONLY" != "true" ]]; then
  INSTALL_WATCH=false
elif [[ "$WANT_WATCH_ONLY" == "true" ]] && [[ "$WANT_IOS_ONLY" != "true" ]]; then
  INSTALL_IOS=false
fi

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

# --- verify required toolchain ----------------------------------------------
if ! command -v xcodegen >/dev/null 2>&1; then
  warn "Could not find xcodegen on PATH (brew install xcodegen)."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  warn "Could not find xcodebuild on PATH."
  exit 1
fi

if ! command -v xcrun >/dev/null 2>&1; then
  warn "Could not find xcrun on PATH."
  exit 1
fi

# --- sanity-check config ---------------------------------------------------
if [[ "$INSTALL_IOS" == "true" ]]; then
  GOOGLE_SERVICES="$IOS_DIR/Contempo/GoogleService-Info.plist"
  if [[ ! -f "$GOOGLE_SERVICES" ]]; then
    warn "ios/Contempo/GoogleService-Info.plist is missing — required for a real-Firebase build. See GoogleService-Info.plist.example."
    exit 1
  fi
  if grep -q "REPLACE_" "$GOOGLE_SERVICES"; then
    warn "ios/Contempo/GoogleService-Info.plist still has placeholder values — this won't talk to a real project."
    exit 1
  fi
  PROJECT_ID="$(sed -n 's/.*<key>PROJECT_ID<\/key>.*<string>\(.*\)<\/string>.*/\1/p' "$GOOGLE_SERVICES" | tr -d ' \t')"
  if [[ -z "$PROJECT_ID" ]]; then
    PROJECT_ID="$(python3 -c "import plistlib; print(plistlib.load(open('$GOOGLE_SERVICES', 'rb')).get('PROJECT_ID', 'unknown'))" 2>/dev/null || echo "unknown")"
  fi
  echo "  GoogleService-Info.plist -> project \"$PROJECT_ID\""

  SECRETS_XCCONFIG="$IOS_DIR/Contempo/Config/Secrets.xcconfig"
  if [[ -f "$SECRETS_XCCONFIG" ]] && grep -q -E "^REVERSED_CLIENT_ID\s*=\s*\S+" "$SECRETS_XCCONFIG"; then
    echo "  REVERSED_CLIENT_ID is set in Secrets.xcconfig"
  else
    warn "REVERSED_CLIENT_ID is not set in ios/Contempo/Config/Secrets.xcconfig — real Google Sign-In will fail at runtime (see Secrets.xcconfig.example)."
  fi
fi

if [[ "$INSTALL_WATCH" == "true" ]]; then
  WATCH_GOOGLE_SERVICES="$IOS_DIR/Contempo Watch App/GoogleService-Info.plist"
  if [[ ! -f "$WATCH_GOOGLE_SERVICES" ]]; then
    warn "ios/Contempo Watch App/GoogleService-Info.plist is missing — skipping the watch app. See GoogleService-Info.plist.example."
    INSTALL_WATCH=false
  elif grep -q "REPLACE_" "$WATCH_GOOGLE_SERVICES"; then
    warn "ios/Contempo Watch App/GoogleService-Info.plist still has placeholder values — skipping the watch app."
    INSTALL_WATCH=false
  fi
fi

if [[ "$INSTALL_IOS" != "true" ]] && [[ "$INSTALL_WATCH" != "true" ]]; then
  warn "Nothing to install."
  exit 1
fi

# --- locate iOS & watchOS simulators / devices -----------------------------
IOS_DEST_ID=""
IS_IOS_PHYSICAL=false

log "Looking for iOS target device / simulator..."
if [[ "$INSTALL_IOS" == "true" ]]; then
  # Look for booted simulator first, then available simulator
  IOS_DEST_ID="$(xcrun simctl list devices | grep -E "iPhone.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
  if [[ -z "$IOS_DEST_ID" ]]; then
    IOS_DEST_ID="$(xcrun simctl list devices available | grep "iPhone" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
  fi

  if [[ -z "$IOS_DEST_ID" ]]; then
    warn "Could not find an available iOS device or Simulator."
    exit 1
  fi
  echo "  using iOS Simulator: $IOS_DEST_ID"
fi

WATCH_DEST_ID=""
if [[ "$INSTALL_WATCH" == "true" ]]; then
  log "Looking for watchOS target device / simulator..."
  WATCH_DEST_ID="$(xcrun simctl list devices | grep -E "Watch.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
  if [[ -z "$WATCH_DEST_ID" ]]; then
    WATCH_DEST_ID="$(xcrun simctl list devices available | grep "Watch" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
  fi

  if [[ -n "$WATCH_DEST_ID" ]]; then
    echo "  using watchOS Simulator: $WATCH_DEST_ID"
  else
    echo "  none found — skipping watchOS app"
    INSTALL_WATCH=false
  fi
fi

# Ensure Simulator app is open and booted if using Simulators
if [[ "$INSTALL_IOS" == "true" ]] && [[ "$IS_IOS_PHYSICAL" != "true" ]]; then
  open -a Simulator 2>/dev/null || true
  xcrun simctl boot "$IOS_DEST_ID" 2>/dev/null || true
  xcrun simctl bootstatus "$IOS_DEST_ID" -b >/dev/null 2>&1 || true
fi
if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]]; then
  xcrun simctl boot "$WATCH_DEST_ID" 2>/dev/null || true
  xcrun simctl bootstatus "$WATCH_DEST_ID" -b >/dev/null 2>&1 || true
fi

# --- generate project & build ----------------------------------------------
log "Generating Xcode project with xcodegen..."
( cd "$IOS_DIR" && xcodegen generate )

log "Building Contempo iOS & watchOS apps in Release (prod) configuration..."
( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -configuration Release -destination "id=$IOS_DEST_ID" -derivedDataPath Build build )

IOS_APP_PATH="$(find "$IOS_DIR/Build" -name "Contempo.app" -type d | head -n 1)"
WATCH_APP_PATH="$(find "$IOS_DIR/Build" -name "Contempo Watch App.app" -type d | head -n 1)"

if [[ "$INSTALL_IOS" == "true" ]] && [[ -z "$IOS_APP_PATH" || ! -d "$IOS_APP_PATH" ]]; then
  warn "Could not find built Contempo.app bundle in $IOS_DIR/Build."
  exit 1
fi

# --- install ----------------------------------------------------------------
if [[ "$INSTALL_IOS" == "true" ]]; then
  log "Installing Release app (com.hejitech.contempo) onto $IOS_DEST_ID..."
  xcrun simctl install "$IOS_DEST_ID" "$IOS_APP_PATH"
fi

if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]] && [[ -n "$WATCH_APP_PATH" ]] && [[ -d "$WATCH_APP_PATH" ]]; then
  log "Installing Release watch app (com.hejitech.contempo.watchkitapp) onto $WATCH_DEST_ID..."
  xcrun simctl install "$WATCH_DEST_ID" "$WATCH_APP_PATH" 2>/dev/null || true
fi

if [[ "$LAUNCH" != "true" ]]; then
  log "Installed. Skipping launch (--no-launch)."
  exit 0
fi

# --- launch ------------------------------------------------------------------
if [[ "$INSTALL_IOS" == "true" ]]; then
  log "Launching Contempo..."
  if ! xcrun simctl launch "$IOS_DEST_ID" com.hejitech.contempo 2>/dev/null; then
    sleep 1
    xcrun simctl launch "$IOS_DEST_ID" com.hejitech.contempo
  fi
fi

if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]]; then
  log "Launching Contempo Watch App..."
  if ! xcrun simctl launch "$WATCH_DEST_ID" com.hejitech.contempo.watchkitapp 2>/dev/null; then
    sleep 1
    xcrun simctl launch "$WATCH_DEST_ID" com.hejitech.contempo.watchkitapp 2>/dev/null || true
  fi
fi

log "Done."
