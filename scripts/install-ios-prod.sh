#!/usr/bin/env bash
# Builds and installs the "prod" (Release configuration) iOS app onto an iOS
# simulator or connected physical device — real Firebase (contempo-platform),
# real Google Sign-In, no emulator wiring. Unlike
# scripts/run-ios-with-emulators.sh, this never starts or touches the
# Firebase emulator suite.
#
# If a watchOS simulator or device is available, the watchOS companion app is
# built and installed on it too, same Release configuration. Embedded targets
# (ContempoWidgets and Contempo Watch Widgets) are built and included automatically.
#
# Usage: ./scripts/install-ios-prod.sh [options]
#   --no-launch, --build-only     : build and install only, skip launching.
#   --ios                         : only install the iOS phone app, skip the watch app.
#   --watch-os, --watchOS, --watch: only install the watchOS companion app, skip the phone app.
#   -s, --device <id_or_name>     : target a specific iOS simulator or physical device ID/name.
#   --watch-device <id_or_name>   : target a specific watchOS simulator or physical device ID/name.
#   --clean                       : clean build artifacts before building.
#   -h, --help                    : show this help message.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"

LAUNCH=true
INSTALL_IOS=true
INSTALL_WATCH=true
WANT_IOS_ONLY=false
WANT_WATCH_ONLY=false
TARGET_IOS_DEST="${IOS_DEST_ID:-}"
TARGET_WATCH_DEST=""
CLEAN=false

show_help() {
  cat <<'EOF'
Usage: ./scripts/install-ios-prod.sh [options]

Builds and installs the production (Release configuration) iOS app, watchOS companion app, and embedded Widget extensions.

Options:
  --no-launch, --build-only      Build and install only, skip launching the app(s).
  --ios                          Install only the iOS phone app, skip the watchOS app.
  --watch-os, --watchOS, --watch Install only the watchOS companion app, skip the phone app.
  -s, --device <id_or_name>      Specify target iOS simulator or physical device ID/name.
  --watch-device <id_or_name>    Specify target watchOS simulator or physical device ID/name.
  --clean                        Clean build artifacts before building.
  -h, --help                     Show this help message and exit.
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-launch|--build-only)
      LAUNCH=false
      shift
      ;;
    --ios)
      WANT_IOS_ONLY=true
      shift
      ;;
    --watch-os|--watchOS|--watch)
      WANT_WATCH_ONLY=true
      shift
      ;;
    -s|--device)
      if [[ -z "${2:-}" ]]; then
        echo "Error: $1 requires a device ID or name argument." >&2
        exit 1
      fi
      TARGET_IOS_DEST="$2"
      shift 2
      ;;
    --watch-device)
      if [[ -z "${2:-}" ]]; then
        echo "Error: $1 requires a device ID or name argument." >&2
        exit 1
      fi
      TARGET_WATCH_DEST="$2"
      shift 2
      ;;
    --clean)
      CLEAN=true
      shift
      ;;
    -h|--help)
      show_help
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Run '$0 --help' for usage details." >&2
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

# --- locate iOS & watchOS target devices / simulators -----------------------
IOS_DEST_ID=""
IS_IOS_PHYSICAL=false

# Always locate an iOS simulator/device to use as the xcodebuild destination —
# even in --watch-only mode — because the watchOS app is an embedded target
# inside the Contempo scheme and xcodebuild requires a valid iOS destination.
log "Looking for iOS target device / simulator..."
if [[ -n "$TARGET_IOS_DEST" ]]; then
  IOS_DEST_ID="$TARGET_IOS_DEST"
  if xcrun simctl list devices 2>/dev/null | grep -q "$IOS_DEST_ID"; then
    IS_IOS_PHYSICAL=false
    echo "  using specified iOS Simulator: $IOS_DEST_ID"
  else
    IS_IOS_PHYSICAL=true
    echo "  using specified physical iOS device: $IOS_DEST_ID"
  fi
else
  # 1. Look for booted simulator
  IOS_DEST_ID="$(xcrun simctl list devices 2>/dev/null | grep -E "iPhone.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
  # 2. Look for available simulator
  if [[ -z "$IOS_DEST_ID" ]]; then
    IOS_DEST_ID="$(xcrun simctl list devices available 2>/dev/null | grep "iPhone" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
  fi

  if [[ -z "$IOS_DEST_ID" ]]; then
    warn "Could not find an available iOS device or Simulator (needed as xcodebuild destination even for watch-only builds)."
    exit 1
  fi

  if [[ "$INSTALL_IOS" == "true" ]]; then
    echo "  using iOS Simulator: $IOS_DEST_ID"
  else
    echo "  using iOS Simulator $IOS_DEST_ID as xcodebuild host (watch-only mode)"
  fi
fi

WATCH_DEST_ID=""
IS_WATCH_PHYSICAL=false
if [[ "$INSTALL_WATCH" == "true" ]]; then
  log "Looking for watchOS target device / simulator..."
  if [[ -n "$TARGET_WATCH_DEST" ]]; then
    WATCH_DEST_ID="$TARGET_WATCH_DEST"
    if xcrun simctl list devices 2>/dev/null | grep -q "$WATCH_DEST_ID"; then
      IS_WATCH_PHYSICAL=false
      echo "  using specified watchOS Simulator: $WATCH_DEST_ID"
    else
      IS_WATCH_PHYSICAL=true
      echo "  using specified physical watchOS device: $WATCH_DEST_ID"
    fi
  else
    WATCH_DEST_ID="$(xcrun simctl list devices 2>/dev/null | grep -E "Watch.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
    if [[ -z "$WATCH_DEST_ID" ]]; then
      WATCH_DEST_ID="$(xcrun simctl list devices available 2>/dev/null | grep "Watch" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
    fi

    if [[ -n "$WATCH_DEST_ID" ]]; then
      echo "  using watchOS Simulator: $WATCH_DEST_ID"
    else
      echo "  none found — skipping watchOS app"
      INSTALL_WATCH=false
    fi
  fi
fi

# Boot Simulators if necessary
if [[ "$INSTALL_IOS" == "true" ]] && [[ "$IS_IOS_PHYSICAL" != "true" ]]; then
  open -a Simulator 2>/dev/null || true
  xcrun simctl boot "$IOS_DEST_ID" 2>/dev/null || true
  xcrun simctl bootstatus "$IOS_DEST_ID" -b >/dev/null 2>&1 || true
fi
if [[ "$INSTALL_WATCH" == "true" ]] && [[ "$IS_WATCH_PHYSICAL" != "true" ]] && [[ -n "$WATCH_DEST_ID" ]]; then
  xcrun simctl boot "$WATCH_DEST_ID" 2>/dev/null || true
  xcrun simctl bootstatus "$WATCH_DEST_ID" -b >/dev/null 2>&1 || true
fi

# --- generate project & build ----------------------------------------------
if [[ "$CLEAN" == "true" ]]; then
  log "Cleaning Xcode build directory..."
  rm -rf "$IOS_DIR/Build" "$IOS_DIR/Contempo.xcodeproj"
fi

log "Generating Xcode project with xcodegen..."
( cd "$IOS_DIR" && xcodegen generate )

BUILD_DEST="id=$IOS_DEST_ID"
if [[ "$IS_IOS_PHYSICAL" == "true" ]]; then
  BUILD_DEST="generic/platform=iOS"
fi

log "Resolving Swift Package dependencies..."
if ! ( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -destination "$BUILD_DEST" -derivedDataPath Build -resolvePackageDependencies ); then
  warn "Package dependency resolution failed. Clearing corrupted SwiftPM artifact cache and retrying..."
  rm -rf "$HOME/Library/Caches/org.swift.swiftpm/artifacts"/* "$HOME/Library/Caches/org.swift.swiftpm/repositories"/* 2>/dev/null || true
  ( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -destination "$BUILD_DEST" -derivedDataPath Build -resolvePackageDependencies )
fi

log "Building Contempo iOS app, watchOS app, and ContempoWidgets in Release (prod) configuration..."
( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -configuration Release -destination "$BUILD_DEST" -derivedDataPath Build build )


IOS_APP_PATH="$(find "$IOS_DIR/Build/Build/Products" -maxdepth 2 -name "Contempo.app" -not -path "*/Watch/*" -type d 2>/dev/null | head -n 1)"
# Prefer the standalone watchsimulator/watch product over the copy embedded
# inside Contempo.app/Watch/ — simctl install on the watch simulator needs
# the top-level standalone bundle, not the embedded one.
WATCH_APP_PATH="$(find "$IOS_DIR/Build/Build/Products" -maxdepth 2 -name "Contempo Watch App.app" -type d 2>/dev/null | grep -v "/Watch/" | head -n 1)"
if [[ -z "$WATCH_APP_PATH" ]]; then
  WATCH_APP_PATH="$(find "$IOS_DIR/Build" -name "Contempo Watch App.app" -type d 2>/dev/null | head -n 1)"
fi

if [[ "$INSTALL_IOS" == "true" ]] && [[ -z "$IOS_APP_PATH" || ! -d "$IOS_APP_PATH" ]]; then
  warn "Could not find built Contempo.app bundle in $IOS_DIR/Build."
  exit 1
fi

# --- install ----------------------------------------------------------------
if [[ "$INSTALL_IOS" == "true" ]]; then
  if [[ "$IS_IOS_PHYSICAL" == "true" ]]; then
    log "Installing Release app (com.hejitech.contempo) onto physical iOS device $IOS_DEST_ID..."
    if command -v devicectl >/dev/null 2>&1 || xcrun --find devicectl >/dev/null 2>&1; then
      xcrun devicectl device install app --device "$IOS_DEST_ID" "$IOS_APP_PATH"
    elif command -v ios-deploy >/dev/null 2>&1; then
      ios-deploy --id "$IOS_DEST_ID" --bundle "$IOS_APP_PATH"
    else
      warn "Neither xcrun devicectl nor ios-deploy found. Cannot install onto physical device."
      exit 1
    fi
  else
    log "Installing Release app (com.hejitech.contempo) onto simulator $IOS_DEST_ID..."
    xcrun simctl install "$IOS_DEST_ID" "$IOS_APP_PATH"
  fi
fi

if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]] && [[ -n "$WATCH_APP_PATH" ]] && [[ -d "$WATCH_APP_PATH" ]]; then
  if [[ "$IS_WATCH_PHYSICAL" == "true" ]]; then
    log "Installing Release watch app (com.hejitech.contempo.watchkitapp) onto physical watch $WATCH_DEST_ID..."
    if command -v devicectl >/dev/null 2>&1 || xcrun --find devicectl >/dev/null 2>&1; then
      xcrun devicectl device install app --device "$WATCH_DEST_ID" "$WATCH_APP_PATH" 2>/dev/null || true
    fi
  else
    log "Installing Release watch app (com.hejitech.contempo.watchkitapp) onto simulator $WATCH_DEST_ID..."
    xcrun simctl install "$WATCH_DEST_ID" "$WATCH_APP_PATH" 2>/dev/null || true
  fi
fi

if [[ "$LAUNCH" != "true" ]]; then
  log "Installed. Skipping launch (--no-launch)."
  exit 0
fi

# --- launch ------------------------------------------------------------------
if [[ "$INSTALL_IOS" == "true" ]]; then
  log "Launching Contempo..."
  if [[ "$IS_IOS_PHYSICAL" == "true" ]]; then
    if command -v devicectl >/dev/null 2>&1 || xcrun --find devicectl >/dev/null 2>&1; then
      xcrun devicectl device process launch --device "$IOS_DEST_ID" com.hejitech.contempo 2>/dev/null || true
    elif command -v ios-deploy >/dev/null 2>&1; then
      ios-deploy --id "$IOS_DEST_ID" --justlaunch --bundle "$IOS_APP_PATH" 2>/dev/null || true
    fi
  else
    if ! xcrun simctl launch "$IOS_DEST_ID" com.hejitech.contempo 2>/dev/null; then
      sleep 1
      xcrun simctl launch "$IOS_DEST_ID" com.hejitech.contempo
    fi
  fi
fi

if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]]; then
  log "Launching Contempo Watch App..."
  if [[ "$IS_WATCH_PHYSICAL" != "true" ]]; then
    if ! xcrun simctl launch "$WATCH_DEST_ID" com.hejitech.contempo.watchkitapp 2>/dev/null; then
      sleep 1
      xcrun simctl launch "$WATCH_DEST_ID" com.hejitech.contempo.watchkitapp 2>/dev/null || true
    fi
  fi
fi

log "Done."

