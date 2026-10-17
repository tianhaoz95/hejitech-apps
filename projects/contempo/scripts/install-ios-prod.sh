#!/usr/bin/env bash
# Builds and installs the "prod" (Release configuration) iOS app against the hosted backend (the
# shared HEJI Supabase project). Prefers the connected iPhone (the monorepo rule), signed with the
# team's existing Apple Development identity through the App Store Connect API key
# (FA_ASC_KEY_ID / FA_ASC_ISSUER_ID / FA_KEY_LOCATION, or ASC_*), since Release's App Store
# distribution profiles can't install on a device. Falls back to a simulator when no iPhone is
# connected, or with --simulator.
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
#   --simulator                   : use a simulator even when an iPhone is connected.
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
FORCE_SIMULATOR=false

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
  --simulator                    Use a simulator even when an iPhone is connected.
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
    --simulator)
      FORCE_SIMULATOR=true
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

# Every device/simulator tool (devicectl, simctl, xcodebuild) first runs Xcode's first-launch setup.
# After an Xcode update that setup needs an admin password, so from a script it waits forever
# (and CoreSimulator reports "out of date"). Stop with the fix instead of hanging.
if ! xcodebuild -checkFirstLaunchStatus >/dev/null 2>&1; then
  warn "Xcode's first-launch setup hasn't run since the last Xcode update, so device and simulator tools would hang. Run once:  sudo xcodebuild -runFirstLaunch"
  exit 1
fi

# Backend: the shared HEJI Supabase project (projects/contempo/backend.env), compiled into
# ContempoCore's ContempoBackend.swift; nothing to configure locally.

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
  # 1. A connected iPhone (paired, reachable now), unless --simulator.
  if [[ "$FORCE_SIMULATOR" != "true" ]]; then
    DEVICES_JSON="$(mktemp)"
    if xcrun devicectl list devices --json-output "$DEVICES_JSON" >/dev/null 2>&1; then
      IOS_DEST_ID="$(python3 - "$DEVICES_JSON" <<'PY'
import json, sys
devices = json.load(open(sys.argv[1])).get("result", {}).get("devices", [])
for d in devices:
    hw, conn = d.get("hardwareProperties", {}), d.get("connectionProperties", {})
    if hw.get("deviceType") == "iPhone" and conn.get("pairingState") == "paired" and conn.get("tunnelState") != "unavailable":
        print(hw.get("udid", "")); break
PY
)"
    fi
    rm -f "$DEVICES_JSON"
    if [[ -n "$IOS_DEST_ID" ]]; then
      IS_IOS_PHYSICAL=true
      echo "  using connected iPhone: $IOS_DEST_ID"
    fi
  fi
fi
if [[ -z "$IOS_DEST_ID" ]]; then
  # 2. Look for booted simulator
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
SIGNING_ARGS=()
if [[ "$IS_IOS_PHYSICAL" == "true" ]]; then
  # Release signs for App Store distribution; a device install needs a development profile.
  # Automatic signing with the team's existing Apple Development identity, profiles through the
  # App Store Connect API key (never let it mint a new certificate: the identity must already be
  # in the login keychain).
  ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}"
  ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}"
  ASC_KEY_PATH="${ASC_KEY_PATH:-$(eval echo "${FA_KEY_LOCATION:-}")}"
  if [[ -z "$ASC_KEY_ID" || -z "$ASC_ISSUER_ID" || ! -f "$ASC_KEY_PATH" ]]; then
    warn "A device build needs the App Store Connect API key: set FA_ASC_KEY_ID, FA_ASC_ISSUER_ID and FA_KEY_LOCATION (or ASC_*), or pass --simulator."
    exit 1
  fi
  if ! security find-identity -v -p codesigning | grep -q "Apple Development"; then
    warn "No Apple Development identity in the keychain; import the team's (~/Credentials/tianhaozhou-apple-dev-cert.p12) rather than letting Xcode create one."
    exit 1
  fi
  SIGNING_ARGS=(
    -allowProvisioningUpdates
    -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID"
    CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY="Apple Development" PROVISIONING_PROFILE_SPECIFIER=
  )
fi

log "Resolving Swift Package dependencies..."
if ! ( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -destination "$BUILD_DEST" -derivedDataPath Build -resolvePackageDependencies ${SIGNING_ARGS[@]+"${SIGNING_ARGS[@]:0:7}"} ); then
  warn "Package dependency resolution failed. Clearing corrupted SwiftPM artifact cache and retrying..."
  rm -rf "$HOME/Library/Caches/org.swift.swiftpm/artifacts"/* "$HOME/Library/Caches/org.swift.swiftpm/repositories"/* 2>/dev/null || true
  ( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -destination "$BUILD_DEST" -derivedDataPath Build -resolvePackageDependencies ${SIGNING_ARGS[@]+"${SIGNING_ARGS[@]:0:7}"} )
fi

log "Building Contempo iOS app, watchOS app, and ContempoWidgets in Release (prod) configuration..."
( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -configuration Release -destination "$BUILD_DEST" -derivedDataPath Build ${SIGNING_ARGS[@]+"${SIGNING_ARGS[@]}"} build )


RELEASE_DIR="Release-iphonesimulator"
[[ "$IS_IOS_PHYSICAL" == "true" ]] && RELEASE_DIR="Release-iphoneos"
IOS_APP_PATH="$(find "$IOS_DIR/Build/Build/Products/$RELEASE_DIR" -maxdepth 1 -name "Contempo.app" -type d 2>/dev/null | head -n 1)"
if [[ -z "$IOS_APP_PATH" ]]; then
  IOS_APP_PATH="$(find "$IOS_DIR/Build/Build/Products" -name "Contempo.app" -not -path "*/Watch/*" -type d 2>/dev/null | head -n 1)"
fi

# Prefer the freshly built Release watch app (standalone watchsimulator bundle or embedded inside Contempo.app/Watch/)
WATCH_APP_PATH="$(find "$IOS_DIR/Build/Build/Products" -path "*/Release-watchsimulator*" -name "Contempo Watch App.app" -type d 2>/dev/null | head -n 1)"
if [[ -z "$WATCH_APP_PATH" || ! -d "$WATCH_APP_PATH" ]] && [[ -n "$IOS_APP_PATH" ]] && [[ -d "$IOS_APP_PATH/Watch/Contempo Watch App.app" ]]; then
  WATCH_APP_PATH="$IOS_APP_PATH/Watch/Contempo Watch App.app"
fi
if [[ -z "$WATCH_APP_PATH" || ! -d "$WATCH_APP_PATH" ]]; then
  WATCH_APP_PATH="$(find "$IOS_DIR/Build/Build/Products" -path "*/Release-*" -name "Contempo Watch App.app" -type d 2>/dev/null | head -n 1)"
fi

if [[ "$INSTALL_IOS" == "true" ]] && [[ -z "$IOS_APP_PATH" || ! -d "$IOS_APP_PATH" ]]; then
  warn "Could not find built Contempo.app bundle in $IOS_DIR/Build."
  exit 1
fi

# --- install ----------------------------------------------------------------
if [[ "$INSTALL_IOS" == "true" ]]; then
  if [[ "$IS_IOS_PHYSICAL" == "true" ]]; then
    log "Installing Release app (com.hejitech.contempoapp) onto physical iOS device $IOS_DEST_ID..."
    if command -v devicectl >/dev/null 2>&1 || xcrun --find devicectl >/dev/null 2>&1; then
      xcrun devicectl device install app --device "$IOS_DEST_ID" "$IOS_APP_PATH"
    elif command -v ios-deploy >/dev/null 2>&1; then
      ios-deploy --id "$IOS_DEST_ID" --bundle "$IOS_APP_PATH"
    else
      warn "Neither xcrun devicectl nor ios-deploy found. Cannot install onto physical device."
      exit 1
    fi
  else
    log "Installing Release app (com.hejitech.contempoapp) onto simulator $IOS_DEST_ID..."
    xcrun simctl install "$IOS_DEST_ID" "$IOS_APP_PATH"
  fi
fi

if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]] && [[ -n "$WATCH_APP_PATH" ]] && [[ -d "$WATCH_APP_PATH" ]]; then
  if [[ "$IS_WATCH_PHYSICAL" == "true" ]]; then
    log "Installing Release watch app (com.hejitech.contempoapp.watchkitapp) onto physical watch $WATCH_DEST_ID..."
    if command -v devicectl >/dev/null 2>&1 || xcrun --find devicectl >/dev/null 2>&1; then
      xcrun devicectl device install app --device "$WATCH_DEST_ID" "$WATCH_APP_PATH" 2>/dev/null || true
    fi
  else
    log "Installing Release watch app (com.hejitech.contempoapp.watchkitapp) onto simulator $WATCH_DEST_ID..."
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
      xcrun devicectl device process launch --device "$IOS_DEST_ID" com.hejitech.contempoapp 2>/dev/null || true
    elif command -v ios-deploy >/dev/null 2>&1; then
      ios-deploy --id "$IOS_DEST_ID" --justlaunch --bundle "$IOS_APP_PATH" 2>/dev/null || true
    fi
  else
    if ! xcrun simctl launch "$IOS_DEST_ID" com.hejitech.contempoapp 2>/dev/null; then
      sleep 1
      xcrun simctl launch "$IOS_DEST_ID" com.hejitech.contempoapp
    fi
  fi
fi

if [[ "$INSTALL_WATCH" == "true" ]] && [[ -n "$WATCH_DEST_ID" ]]; then
  log "Launching Contempo Watch App..."
  if [[ "$IS_WATCH_PHYSICAL" != "true" ]]; then
    if ! xcrun simctl launch "$WATCH_DEST_ID" com.hejitech.contempoapp.watchkitapp 2>/dev/null; then
      sleep 1
      xcrun simctl launch "$WATCH_DEST_ID" com.hejitech.contempoapp.watchkitapp 2>/dev/null || true
    fi
  fi
fi

log "Done."

