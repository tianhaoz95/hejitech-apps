#!/usr/bin/env bash
# Builds and installs the "prod" (release build type) Android app onto a
# connected physical device — real Firebase (contempo-platform), real Google
# Sign-In, no emulator wiring. Unlike scripts/run-android-with-emulators.sh,
# this never starts or touches the Firebase emulator suite.
#
# If a Wear OS device is also connected (an emulator or a real watch — either
# way, whatever declares the android.hardware.type.watch feature), the wear/
# companion app is built and installed on it too, same release build type.
# This is best-effort: no wear device found is not an error, it's the normal
# case for anyone not also testing the watch app.
#
# The release build type reuses the default debug keystore/signing config
# (see app/build.gradle.kts and wear/build.gradle.kts) rather than a
# dedicated release key — that debug keystore's SHA-1/SHA-256 are what's
# registered with the real project for Google Sign-In, and there's no Play
# Store pipeline yet to need a real signing key for. "prod" means "real
# backend," not "ready to publish."
#
# Usage: ./scripts/install-android-prod.sh [options]
#   --no-launch, --build-only  : build and install only, skip launching.
#   --android                 : only install the phone app, skip the wear/ companion app.
#   --wear-os, --wear, --wearOS: only install the wear/ companion app, skip the phone app.
#   -s, --device <serial>     : target a specific phone device serial.
#   --wear-device <serial>    : target a specific Wear OS device serial.
#   --clean                   : run `./gradlew clean` before building.
#   -h, --help                : show this help message.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

LAUNCH=true
INSTALL_ANDROID=true
INSTALL_WEAR=true
WANT_ANDROID_ONLY=false
WANT_WEAR_ONLY=false
TARGET_DEVICE_SERIAL="${ANDROID_SERIAL:-}"
TARGET_WEAR_SERIAL=""
CLEAN=false

show_help() {
  cat <<'EOF'
Usage: ./scripts/install-android-prod.sh [options]

Builds and installs the production (release) Android phone app and Wear OS companion app.

Options:
  --no-launch, --build-only   Build and install only, skip launching the app(s).
  --android                   Install only the phone app, skip the wear/ companion app.
  --wear-os, --wear, --wearOS Install only the wear/ companion app, skip the phone app.
  -s, --device <serial>       Specify target phone device serial (overrides auto-detection).
  --wear-device <serial>      Specify target Wear OS device serial (overrides auto-detection).
  --clean                     Run `./gradlew clean` before building.
  -h, --help                  Show this help message and exit.
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-launch|--build-only)
      LAUNCH=false
      shift
      ;;
    --android)
      WANT_ANDROID_ONLY=true
      shift
      ;;
    --wear-os|--wear|--wearOS|--wear-OS)
      WANT_WEAR_ONLY=true
      shift
      ;;
    -s|--device)
      if [[ -z "${2:-}" ]]; then
        echo "Error: $1 requires a serial argument." >&2
        exit 1
      fi
      TARGET_DEVICE_SERIAL="$2"
      shift 2
      ;;
    --wear-device)
      if [[ -z "${2:-}" ]]; then
        echo "Error: $1 requires a serial argument." >&2
        exit 1
      fi
      TARGET_WEAR_SERIAL="$2"
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

if [[ "$WANT_ANDROID_ONLY" == "true" && "$WANT_WEAR_ONLY" != "true" ]]; then
  INSTALL_WEAR=false
elif [[ "$WANT_WEAR_ONLY" == "true" && "$WANT_ANDROID_ONLY" != "true" ]]; then
  INSTALL_ANDROID=false
fi

DEVICE_SERIAL=""
ADB=""

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

# --- locate adb -------------------------------------------------------------
if command -v adb >/dev/null 2>&1; then
  ADB="$(command -v adb)"
elif [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  ADB="$ANDROID_HOME/platform-tools/adb"
elif [[ -n "${ANDROID_SDK_ROOT:-}" && -x "$ANDROID_SDK_ROOT/platform-tools/adb" ]]; then
  ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
elif [[ -f "$ANDROID_DIR/local.properties" ]]; then
  SDK_DIR="$(sed -n 's/^sdk.dir=//p' "$ANDROID_DIR/local.properties")"
  if [[ -x "$SDK_DIR/platform-tools/adb" ]]; then
    ADB="$SDK_DIR/platform-tools/adb"
  fi
fi

if [[ -z "$ADB" ]]; then
  warn "Could not find adb (not on PATH, \$ANDROID_HOME/\$ANDROID_SDK_ROOT unset or wrong, and no usable android/local.properties)."
  exit 1
fi

# --- look for a Wear OS device (emulator or real watch) ----------------------
log "Looking for a connected Wear OS device..."
"$ADB" start-server >/dev/null 2>&1 || true
WEAR_SERIAL=""
WEAR_CANDIDATES=()

if [[ -n "$TARGET_WEAR_SERIAL" ]]; then
  WEAR_CANDIDATES=("$TARGET_WEAR_SERIAL")
else
  while IFS=$'\t' read -r serial state; do
    [[ -z "$serial" || -z "$state" ]] && continue
    [[ "$state" != "device" ]] && continue
    if "$ADB" -s "$serial" shell pm list features </dev/null 2>/dev/null | grep -q "android.hardware.type.watch"; then
      WEAR_CANDIDATES+=("$serial")
    fi
  done < <("$ADB" devices | grep -E $'^\\S+\t')
fi

is_wear_serial() {
  local target="$1" candidate
  for candidate in "${WEAR_CANDIDATES[@]:-}"; do
    [[ -n "$candidate" && "$candidate" == "$target" ]] && return 0
  done
  return 1
}

if [[ ${#WEAR_CANDIDATES[@]} -eq 1 ]]; then
  WEAR_SERIAL="${WEAR_CANDIDATES[0]}"
  echo "  using wear device $WEAR_SERIAL"
elif [[ ${#WEAR_CANDIDATES[@]} -eq 0 ]]; then
  echo "  none found — skipping the wear/ companion app"
else
  warn "Multiple Wear OS devices connected: ${WEAR_CANDIDATES[*]}. Skipping the wear/ companion app — use --wear-device <serial> or disconnect all but one to install it too."
fi

if [[ "$INSTALL_WEAR" != "true" ]]; then
  [[ -n "$WEAR_SERIAL" ]] && echo "  --android: skipping the wear/ companion app anyway"
  WEAR_SERIAL=""
fi

if [[ "$INSTALL_ANDROID" != "true" && -z "$WEAR_SERIAL" ]]; then
  warn "Nothing to install: --wear-os was requested but no wear device was found."
  exit 1
fi

# --- find physical device or emulator for phone app -------------------------
if [[ "$INSTALL_ANDROID" == "true" ]]; then
  log "Looking for a connected physical device or emulator..."
  if [[ -n "$TARGET_DEVICE_SERIAL" ]]; then
    DEVICE_SERIAL="$TARGET_DEVICE_SERIAL"
    export ANDROID_SERIAL="$DEVICE_SERIAL"
    echo "  using specified device $DEVICE_SERIAL"
  else
    PHYSICAL_CANDIDATES=()
    EMULATOR_CANDIDATES=()
    while IFS=$'\t' read -r serial state; do
      [[ -z "$serial" || -z "$state" ]] && continue
      is_wear_serial "$serial" && continue
      if [[ "$state" == "device" ]]; then
        if [[ "$serial" =~ ^emulator- ]] || [[ "$serial" =~ ^127\.0\.0\.1: ]] || [[ "$serial" =~ ^localhost: ]]; then
          EMULATOR_CANDIDATES+=("$serial")
        else
          PHYSICAL_CANDIDATES+=("$serial")
        fi
      elif [[ "$state" == "unauthorized" ]]; then
        warn "Device $serial is unauthorized — accept the USB debugging prompt on the device."
      fi
    done < <("$ADB" devices | grep -E $'^\\S+\t')

    if [[ ${#PHYSICAL_CANDIDATES[@]} -gt 1 ]]; then
      warn "Multiple physical devices connected: ${PHYSICAL_CANDIDATES[*]}. Use -s/--device <serial> or disconnect all but one and retry."
      exit 1
    elif [[ ${#PHYSICAL_CANDIDATES[@]} -eq 1 ]]; then
      DEVICE_SERIAL="${PHYSICAL_CANDIDATES[0]}"
    elif [[ ${#EMULATOR_CANDIDATES[@]} -gt 1 ]]; then
      warn "Multiple emulators running: ${EMULATOR_CANDIDATES[*]}. Use -s/--device <serial> or close all but one and retry."
      exit 1
    elif [[ ${#EMULATOR_CANDIDATES[@]} -eq 1 ]]; then
      DEVICE_SERIAL="${EMULATOR_CANDIDATES[0]}"
    else
      warn "No authorized physical device or emulator found. Plug in a device via USB or start an emulator, enable USB debugging, and accept the prompt."
      exit 1
    fi
    export ANDROID_SERIAL="$DEVICE_SERIAL"
    echo "  using device $DEVICE_SERIAL"
  fi

  # --- sanity-check config ---------------------------------------------------
  GOOGLE_SERVICES="$ANDROID_DIR/app/google-services.json"
  if [[ ! -f "$GOOGLE_SERVICES" ]]; then
    warn "android/app/google-services.json is missing — required for a real-Firebase build. See google-services.json.example."
    exit 1
  fi
  if grep -q "REPLACE_" "$GOOGLE_SERVICES"; then
    warn "android/app/google-services.json still has placeholder values — this won't talk to a real project."
    exit 1
  fi
  PROJECT_ID="$(python3 -c "import json; print(json.load(open('$GOOGLE_SERVICES'))['project_info']['project_id'])" 2>/dev/null || echo "unknown")"
  echo "  google-services.json -> project \"$PROJECT_ID\""

  if [[ -f "$ANDROID_DIR/local.properties" ]] && grep -q "^GOOGLE_WEB_CLIENT_ID=.\+" "$ANDROID_DIR/local.properties"; then
    echo "  GOOGLE_WEB_CLIENT_ID is set"
  else
    warn "GOOGLE_WEB_CLIENT_ID is not set in android/local.properties — real Google Sign-In will fail at runtime (see local.properties.example)."
  fi
fi

if [[ -n "$WEAR_SERIAL" ]]; then
  WEAR_GOOGLE_SERVICES="$ANDROID_DIR/wear/google-services.json"
  if [[ ! -f "$WEAR_GOOGLE_SERVICES" ]]; then
    warn "android/wear/google-services.json is missing — skipping the wear/ companion app. See google-services.json.example."
    WEAR_SERIAL=""
  elif grep -q "REPLACE_" "$WEAR_GOOGLE_SERVICES"; then
    warn "android/wear/google-services.json still has placeholder values — skipping the wear/ companion app."
    WEAR_SERIAL=""
  fi
fi

if [[ "$INSTALL_ANDROID" != "true" && -z "$WEAR_SERIAL" ]]; then
  warn "Nothing to install: no valid target device or companion app configured."
  exit 1
fi

# --- build and install ------------------------------------------------------
if [[ "$CLEAN" == "true" ]]; then
  log "Cleaning Android build output..."
  ( cd "$ANDROID_DIR" && ./gradlew clean )
fi

if [[ "$INSTALL_ANDROID" == "true" ]]; then
  log "Building and installing the release (prod) app (com.hejitech.contempo) on $DEVICE_SERIAL..."
  ( cd "$ANDROID_DIR" && ANDROID_SERIAL="$DEVICE_SERIAL" ./gradlew :app:installRelease )
fi

if [[ -n "$WEAR_SERIAL" ]]; then
  log "Building and installing the wear companion app (com.hejitech.wear) on $WEAR_SERIAL..."
  ( cd "$ANDROID_DIR" && ANDROID_SERIAL="$WEAR_SERIAL" ./gradlew :wear:installRelease )
fi

if [[ "$LAUNCH" != "true" ]]; then
  log "Installed. Skipping launch (--no-launch)."
  exit 0
fi

# --- launch ------------------------------------------------------------------
if [[ -n "$WEAR_SERIAL" ]]; then
  log "Launching Contempo on the watch..."
  "$ADB" -s "$WEAR_SERIAL" shell am start -n com.hejitech.wear/com.hejitech.wear.MainActivity >/dev/null
fi

if [[ "$INSTALL_ANDROID" == "true" ]]; then
  log "Launching Contempo..."
  "$ADB" -s "$DEVICE_SERIAL" shell am start -n com.hejitech.contempo/com.hejitech.contempo.MainActivity >/dev/null
fi

log "Done."

