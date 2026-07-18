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
# Store pipeline yet to need a real signing key for. "prod" here means "real
# backend," not "ready to publish."
#
# Builds, installs, and launches, then exits — it never streams logcat. Use
# `adb logcat` yourself if you need to watch the log.
#
# Usage: ./scripts/install-android-prod.sh [--no-launch] [--android] [--wear-os]
#   --no-launch: build and install only, skip launching too.
#   --android:   only install the phone app, skip the wear/ companion app.
#   --wear-os:   only install the wear/ companion app, skip the phone app.
#   Passing neither (or both) installs both, which is the default.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

LAUNCH=true
INSTALL_ANDROID=true
INSTALL_WEAR=true
WANT_ANDROID_ONLY=false
WANT_WEAR_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --no-launch) LAUNCH=false ;;
    --android) WANT_ANDROID_ONLY=true ;;
    --wear-os) WANT_WEAR_ONLY=true ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--no-launch] [--android] [--wear-os]" >&2
      exit 1
      ;;
  esac
done
# --android and --wear-os alone each restrict to that platform; passing both
# (or neither) cancels back out to the default of installing both.
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
elif [[ -f "$ANDROID_DIR/local.properties" ]]; then
  SDK_DIR="$(sed -n 's/^sdk.dir=//p' "$ANDROID_DIR/local.properties")"
  if [[ -x "$SDK_DIR/platform-tools/adb" ]]; then
    ADB="$SDK_DIR/platform-tools/adb"
  fi
fi
if [[ -z "$ADB" ]]; then
  warn "Could not find adb (not on PATH, and no usable android/local.properties)."
  exit 1
fi

# --- look for a Wear OS device (emulator or real watch) ----------------------
# Run before the phone search below, and excluded from it: a real watch
# connected over adb has no "emulator-" prefix to tell it apart from a phone,
# so without this the phone search could miscount it as a second phone and
# abort with a confusing "multiple physical devices" error. Detected by
# feature flag, not serial naming, so an AVD is picked up the same way a real
# watch is.
# (Written for bash 3.2 — macOS's default /bin/bash — so no mapfile/readarray,
# and no associative arrays for the "is this serial a watch" containment
# check below.)
log "Looking for a connected Wear OS device..."
"$ADB" start-server >/dev/null 2>&1 || true
WEAR_SERIAL=""
WEAR_CANDIDATES=()
while IFS=$'\t' read -r serial state; do
  [[ -z "$serial" || -z "$state" ]] && continue
  [[ "$state" != "device" ]] && continue
  # </dev/null matters: without it, `adb shell` inherits this loop's own
  # stdin (the process-substitution pipe below) and can drain it, starving
  # the next `read` — reproduced live: the loop silently stopped after the
  # first device once this call was in its body.
  if "$ADB" -s "$serial" shell pm list features </dev/null 2>/dev/null | grep -q "android.hardware.type.watch"; then
    WEAR_CANDIDATES+=("$serial")
  fi
done < <("$ADB" devices | grep -E $'^\\S+\t')

is_wear_serial() {
  local target="$1" candidate
  # bash 3.2 (macOS's default /bin/bash) treats "${arr[@]}" on an empty array
  # as an unbound variable under `set -u` — the ${arr[@]:-} default guards
  # against that when WEAR_CANDIDATES has nothing in it.
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
  warn "Multiple Wear OS devices connected: ${WEAR_CANDIDATES[*]}. Skipping the wear/ companion app — disconnect all but one to install it too."
fi

if [[ "$INSTALL_WEAR" != "true" ]]; then
  [[ -n "$WEAR_SERIAL" ]] && echo "  --android: skipping the wear/ companion app anyway"
  WEAR_SERIAL=""
fi

if [[ "$INSTALL_ANDROID" != "true" && -z "$WEAR_SERIAL" ]]; then
  warn "Nothing to install: --wear-os was requested but no wear device was found."
  exit 1
fi

# --- find exactly one physical device --------------------------------------
if [[ "$INSTALL_ANDROID" == "true" ]]; then
  log "Looking for a connected physical device..."
  CANDIDATES=()
  while IFS=$'\t' read -r serial state; do
    [[ -z "$serial" || -z "$state" ]] && continue
    case "$serial" in emulator-*) continue ;; esac
    is_wear_serial "$serial" && continue
    if [[ "$state" == "device" ]]; then
      CANDIDATES+=("$serial")
    elif [[ "$state" == "unauthorized" ]]; then
      warn "Device $serial is unauthorized — accept the USB debugging prompt on the device."
    fi
  done < <("$ADB" devices | grep -E $'^\\S+\t')

  if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
    warn "No authorized physical device found. Plug one in via USB, enable USB debugging, and accept the prompt."
    exit 1
  elif [[ ${#CANDIDATES[@]} -gt 1 ]]; then
    warn "Multiple physical devices connected: ${CANDIDATES[*]}. Disconnect all but one and retry."
    exit 1
  fi
  DEVICE_SERIAL="${CANDIDATES[0]}"
  export ANDROID_SERIAL="$DEVICE_SERIAL"
  echo "  using device $DEVICE_SERIAL"

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

# A missing/placeholder wear/google-services.json only skips the wear
# install (WEAR_SERIAL cleared below) — it must never fail the phone install,
# which is this script's actual point.
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

# --- build and install ------------------------------------------------------
if [[ "$INSTALL_ANDROID" == "true" ]]; then
  log "Building and installing the release (prod) app on $DEVICE_SERIAL..."
  ( cd "$ANDROID_DIR" && ./gradlew :app:installRelease )
fi

if [[ -n "$WEAR_SERIAL" ]]; then
  log "Building and installing the wear companion app on $WEAR_SERIAL..."
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
