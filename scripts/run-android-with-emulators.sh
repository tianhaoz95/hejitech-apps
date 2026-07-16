#!/usr/bin/env bash
# Starts the Firebase emulator suite, installs + launches the Android app on
# a connected physical device (over USB), and wires the two together with
# `adb reverse` (the app talks to "localhost" — see ContempoApp.kt). Ctrl+C
# (or any exit) tears everything down: logcat, adb reverse rules, and the
# Firebase emulators themselves.
#
# Usage: ./scripts/run-android-with-emulators.sh [firebase-project-id]
#   Defaults to "demo-contempo" (the placeholder project used throughout
#   local testing). Pass your real project id once android/app/google-services.json
#   has been swapped for the real one.
set -euo pipefail
set -m # give the emulator suite its own process group so it can be killed as a unit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
BACKEND_DIR="$ROOT_DIR/backend"
PROJECT_ID="${1:-demo-contempo}"

EMULATOR_PORTS=(9099 8080 9199 5001) # auth, firestore, storage, functions
EMULATOR_LOG="$(mktemp -t contempo-emulators.XXXXXX.log)"
READY_TIMEOUT=90

FIREBASE_PID=""
LOGCAT_PID=""
DEVICE_SERIAL=""
ADB=""

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  log "Shutting down..."

  if [[ -n "$LOGCAT_PID" ]] && kill -0 "$LOGCAT_PID" 2>/dev/null; then
    kill "$LOGCAT_PID" 2>/dev/null || true
    wait "$LOGCAT_PID" 2>/dev/null || true
  fi

  if [[ -n "$ADB" && -n "$DEVICE_SERIAL" ]]; then
    "$ADB" -s "$DEVICE_SERIAL" reverse --remove-all 2>/dev/null || true
    echo "  adb reverse rules removed"
  fi

  if [[ -n "$FIREBASE_PID" ]] && kill -0 "$FIREBASE_PID" 2>/dev/null; then
    echo "  stopping Firebase emulators (pid $FIREBASE_PID)..."
    kill -INT -- "-$FIREBASE_PID" 2>/dev/null || kill -INT "$FIREBASE_PID" 2>/dev/null || true
    for _ in $(seq 1 15); do
      kill -0 "$FIREBASE_PID" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$FIREBASE_PID" 2>/dev/null; then
      warn "emulators still alive after 15s, forcing..."
      kill -KILL -- "-$FIREBASE_PID" 2>/dev/null || kill -KILL "$FIREBASE_PID" 2>/dev/null || true
    fi
    echo "  Firebase emulators stopped"
  fi

  rm -f "$EMULATOR_LOG"
  log "All services stopped."
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
if ! command -v firebase >/dev/null 2>&1; then
  warn "Could not find the firebase CLI on PATH (npm install -g firebase-tools)."
  exit 1
fi

# --- find exactly one physical device --------------------------------------
# (Written for bash 3.2 — macOS's default /bin/bash — so no mapfile/readarray.)
log "Looking for a connected physical device..."
"$ADB" start-server >/dev/null 2>&1 || true
CANDIDATES=()
# Only lines with a serial<TAB>state shape are real device entries — this
# skips the "List of devices attached" header and any daemon-startup chatter
# adb prints ahead of it.
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

# --- sanity-check google-services.json --------------------------------------
GOOGLE_SERVICES="$ANDROID_DIR/app/google-services.json"
if [[ -f "$GOOGLE_SERVICES" ]] && grep -q "REPLACE_" "$GOOGLE_SERVICES"; then
  warn "android/app/google-services.json still has placeholder values."
  warn "Its project_id must match the --project this script passes to the emulators (\"$PROJECT_ID\")."
fi

# --- start the Firebase emulator suite --------------------------------------
log "Starting Firebase emulators (project: $PROJECT_ID)..."
( cd "$BACKEND_DIR" && exec firebase emulators:start --project "$PROJECT_ID" ) >"$EMULATOR_LOG" 2>&1 &
FIREBASE_PID=$!
echo "  pid $FIREBASE_PID, logging to $EMULATOR_LOG"

echo "  waiting for emulators to come up (up to ${READY_TIMEOUT}s)..."
ready=false
for _ in $(seq 1 "$READY_TIMEOUT"); do
  if ! kill -0 "$FIREBASE_PID" 2>/dev/null; then
    warn "Firebase emulator process exited early. Last log lines:"
    tail -n 40 "$EMULATOR_LOG" >&2
    exit 1
  fi
  if grep -q "All emulators ready" "$EMULATOR_LOG" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  warn "Emulators did not report ready within ${READY_TIMEOUT}s. Last log lines:"
  tail -n 40 "$EMULATOR_LOG" >&2
  exit 1
fi
echo "  emulators ready"

# --- wire the device to the host's emulator ports ---------------------------
log "Forwarding device ports to host emulators (adb reverse)..."
for port in "${EMULATOR_PORTS[@]}"; do
  "$ADB" -s "$DEVICE_SERIAL" reverse "tcp:$port" "tcp:$port"
  echo "  tcp:$port -> host tcp:$port"
done

# --- build and install ------------------------------------------------------
log "Building and installing the debug app on $DEVICE_SERIAL..."
( cd "$ANDROID_DIR" && ./gradlew :app:installDebug )

# --- launch ------------------------------------------------------------------
log "Launching Contempo..."
"$ADB" -s "$DEVICE_SERIAL" shell am start -n com.hejitech.contempo/com.hejitech.contempo.MainActivity >/dev/null

log "Streaming logcat (Ctrl+C to stop everything)..."
APP_PID=""
for _ in $(seq 1 10); do
  # `|| true` matters here: pidof exits 1 (pipefail propagates that through
  # the pipe) on every "not found yet" poll, which is the normal/expected
  # case on the first iteration or two right after `am start` — without this
  # guard, `set -e` treats that as a real error and kills the whole script
  # (and its EXIT trap tears down the emulators) before the loop ever gets a
  # chance to retry.
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

wait "$FIREBASE_PID"
