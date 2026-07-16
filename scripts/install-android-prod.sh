#!/usr/bin/env bash
# Builds and installs the "prod" (release build type) Android app onto a
# connected physical device — real Firebase (contempo-platform), real Google
# Sign-In, no emulator wiring. Unlike scripts/run-android-with-emulators.sh,
# this never starts or touches the Firebase emulator suite.
#
# The release build type reuses the default debug keystore/signing config
# (see app/build.gradle.kts) rather than a dedicated release key — that debug
# keystore's SHA-1/SHA-256 are what's registered with the real project for
# Google Sign-In, and there's no Play Store pipeline yet to need a real
# signing key for. "prod" here means "real backend," not "ready to publish."
#
# Usage: ./scripts/install-android-prod.sh [--no-launch]
#   --no-launch: build and install only, skip launching + streaming logcat.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

LAUNCH=true
if [[ "${1:-}" == "--no-launch" ]]; then
  LAUNCH=false
fi

LOGCAT_PID=""
DEVICE_SERIAL=""
ADB=""

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  if [[ -n "$LOGCAT_PID" ]] && kill -0 "$LOGCAT_PID" 2>/dev/null; then
    kill "$LOGCAT_PID" 2>/dev/null || true
    wait "$LOGCAT_PID" 2>/dev/null || true
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

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

# --- find exactly one physical device --------------------------------------
# (Written for bash 3.2 — macOS's default /bin/bash — so no mapfile/readarray.)
log "Looking for a connected physical device..."
"$ADB" start-server >/dev/null 2>&1 || true
CANDIDATES=()
while IFS=$'\t' read -r serial state; do
  [[ -z "$serial" || -z "$state" ]] && continue
  case "$serial" in emulator-*) continue ;; esac
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

# --- sanity-check config -----------------------------------------------------
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

# --- build and install ------------------------------------------------------
log "Building and installing the release (prod) app on $DEVICE_SERIAL..."
( cd "$ANDROID_DIR" && ./gradlew :app:installRelease )

if [[ "$LAUNCH" != "true" ]]; then
  log "Installed. Skipping launch (--no-launch)."
  exit 0
fi

# --- launch ------------------------------------------------------------------
log "Launching Contempo..."
"$ADB" -s "$DEVICE_SERIAL" shell am start -n com.hejitech.contempo/com.hejitech.contempo.MainActivity >/dev/null

log "Streaming logcat (Ctrl+C to stop)..."
APP_PID=""
for _ in $(seq 1 10); do
  # `|| true` matters: pidof exits 1 (the normal "not found yet" case) on
  # early polls, and set -e would otherwise kill the script before the loop
  # gets a chance to retry — see run-android-with-emulators.sh for the same
  # pattern and the incident that prompted it.
  APP_PID="$("$ADB" -s "$DEVICE_SERIAL" shell pidof com.hejitech.contempo 2>/dev/null | tr -d '\r\n ')" || true
  [[ -n "$APP_PID" ]] && break
  sleep 0.5
done
if [[ -n "$APP_PID" ]]; then
  "$ADB" -s "$DEVICE_SERIAL" logcat --pid="$APP_PID" &
else
  warn "Could not resolve the app's PID for filtered logcat; streaming unfiltered instead."
  "$ADB" -s "$DEVICE_SERIAL" logcat &
fi
LOGCAT_PID=$!
wait "$LOGCAT_PID"
