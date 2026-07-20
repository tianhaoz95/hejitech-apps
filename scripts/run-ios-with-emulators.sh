#!/usr/bin/env bash
# Starts the Firebase emulator suite for local iOS testing. Debug builds of
# Contempo (both `Contempo` and `Contempo Watch App` — see
# ios/Contempo/Sources/App/FirebaseBootstrap.swift /
# ios/Contempo Watch App/Sources/App/FirebaseBootstrap.swift) are compiled
# with USE_FIREBASE_EMULATOR and talk to "localhost" on ports 9099/8080/9199/
# 5001 — the iOS Simulator shares the host Mac's network namespace, so
# "localhost" there really does mean this machine, no adb-reverse-style port
# forwarding needed (unlike Android). A physical iOS device is different: it
# is NOT on the same network namespace, so "localhost" from the device means
# the device itself — testing against these emulators from a physical iPhone/
# Watch needs FirebaseBootstrap's `emulatorHost` changed to this Mac's LAN IP
# instead, not just running this script.
#
# This script only starts the emulator suite — building/installing/launching
# the app is still on you via Xcode or `xcodebuild ... -destination
# 'platform=iOS Simulator,name=...'`, since there's no automatable "adb" for
# the Simulator the way scripts/run-android-with-emulators.sh drives a
# physical Android device end to end.
#
# Usage: ./scripts/run-ios-with-emulators.sh [firebase-project-id]
#   Defaults to "demo-contempo" (fully offline, no real project/billing needed).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
PROJECT_ID="${1:-demo-contempo}"

if ! command -v firebase >/dev/null 2>&1; then
  echo "!! Could not find the firebase CLI on PATH (npm install -g firebase-tools, or use npx -y firebase-tools@latest)." >&2
  exit 1
fi

echo "==> Starting Firebase emulators (project: $PROJECT_ID)..."
echo "    Auth:9099  Firestore:8080  Storage:9199  Functions:5001"
echo "    Ctrl+C stops the emulators. Build/run Contempo from Xcode once"
echo "    this reports \"All emulators ready\"."
cd "$BACKEND_DIR"
exec firebase emulators:start --project "$PROJECT_ID"
