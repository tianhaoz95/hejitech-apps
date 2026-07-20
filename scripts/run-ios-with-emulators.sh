#!/usr/bin/env bash
# Starts the Firebase emulator suite, builds, installs, and launches both the
# iOS app (`Contempo`) and watchOS app (`Contempo Watch App`) on iOS/watchOS
# Simulators, streaming logs to stdout. Ctrl+C (or any exit) tears everything
# down: process log streaming and the Firebase emulators themselves.
#
# Debug builds of Contempo (both `Contempo` and `Contempo Watch App`) are
# compiled with USE_FIREBASE_EMULATOR and talk to "localhost" on ports
# 9099/8080/9199/5001. The iOS/watchOS Simulators share the host Mac's network
# namespace, so "localhost" there connects to this machine.
#
# Usage: ./scripts/run-ios-with-emulators.sh [firebase-project-id]
#   Defaults to "demo-contempo" (fully offline, no real project/billing needed).
set -euo pipefail
set -m # give the emulator suite its own process group so it can be killed as a unit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IOS_DIR="$ROOT_DIR/ios"
BACKEND_DIR="$ROOT_DIR/backend"
PROJECT_ID="${1:-demo-contempo}"

EMULATOR_LOG="$(mktemp -t contempo-ios-emulators.XXXXXX.log)"
READY_TIMEOUT=90

FIREBASE_PID=""
LOG_PID=""

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  log "Shutting down..."

  if [[ -n "$LOG_PID" ]] && kill -0 "$LOG_PID" 2>/dev/null; then
    kill "$LOG_PID" 2>/dev/null || true
    wait "$LOG_PID" 2>/dev/null || true
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

# --- verify required toolchain ----------------------------------------------
if ! command -v firebase >/dev/null 2>&1; then
  warn "Could not find the firebase CLI on PATH (npm install -g firebase-tools)."
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  warn "Could not find xcodegen on PATH (brew install xcodegen)."
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  warn "Could not find xcodebuild on PATH."
  exit 1
fi

# --- locate iOS & watchOS simulators ---------------------------------------
log "Locating iOS & watchOS Simulators..."
IOS_SIM_ID=""
WATCH_SIM_ID=""

# Prefer currently booted devices first
IOS_SIM_ID="$(xcrun simctl list devices | grep -E "iPhone.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
WATCH_SIM_ID="$(xcrun simctl list devices | grep -E "Watch.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true

# Fall back to any available available devices if none booted
if [[ -z "$IOS_SIM_ID" ]]; then
  IOS_SIM_ID="$(xcrun simctl list devices available | grep "iPhone" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
fi
if [[ -z "$WATCH_SIM_ID" ]]; then
  WATCH_SIM_ID="$(xcrun simctl list devices available | grep "Watch" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')" || true
fi

if [[ -z "$IOS_SIM_ID" ]]; then
  warn "Could not find an available iOS Simulator."
  exit 1
fi

echo "  using iOS Simulator: $IOS_SIM_ID"
if [[ -n "$WATCH_SIM_ID" ]]; then
  echo "  using watchOS Simulator: $WATCH_SIM_ID"
fi

# Ensure Simulator app is open & devices booted
log "Booting Simulators & opening Simulator.app..."
open -a Simulator || true
xcrun simctl boot "$IOS_SIM_ID" 2>/dev/null || true
if [[ -n "$WATCH_SIM_ID" ]]; then
  xcrun simctl boot "$WATCH_SIM_ID" 2>/dev/null || true
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

# --- generate project & build apps -----------------------------------------
log "Generating Xcode project with xcodegen..."
( cd "$IOS_DIR" && xcodegen generate )

log "Building Contempo iOS & watchOS apps with xcodebuild..."
( cd "$IOS_DIR" && xcodebuild -project Contempo.xcodeproj -scheme Contempo -destination "id=$IOS_SIM_ID" -derivedDataPath Build build )

IOS_APP_PATH="$(find "$IOS_DIR/Build" -name "Contempo.app" -type d | head -n 1)"
WATCH_APP_PATH="$(find "$IOS_DIR/Build" -name "Contempo Watch App.app" -type d | head -n 1)"

if [[ -z "$IOS_APP_PATH" || ! -d "$IOS_APP_PATH" ]]; then
  warn "Could not find built Contempo.app bundle in $IOS_DIR/Build."
  exit 1
fi

# --- install and launch -----------------------------------------------------
log "Installing & launching iOS app (com.hejitech.contempo)..."
xcrun simctl install "$IOS_SIM_ID" "$IOS_APP_PATH"
xcrun simctl launch "$IOS_SIM_ID" com.hejitech.contempo

if [[ -n "$WATCH_SIM_ID" && -d "$WATCH_APP_PATH" ]]; then
  log "Installing & launching watchOS app (com.hejitech.contempo.watchkitapp)..."
  xcrun simctl install "$WATCH_SIM_ID" "$WATCH_APP_PATH" 2>/dev/null || true
  xcrun simctl launch "$WATCH_SIM_ID" com.hejitech.contempo.watchkitapp 2>/dev/null || true
fi

log "Streaming iOS simulator logs (Ctrl+C to stop everything)..."
xcrun simctl spawn "$IOS_SIM_ID" log stream --predicate 'process == "Contempo"' &
LOG_PID=$!

wait "$FIREBASE_PID"
