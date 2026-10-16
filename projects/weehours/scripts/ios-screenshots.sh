#!/usr/bin/env bash
# Builds the app, runs it in the iOS simulator against the local backend and captures the
# screens used by the report. Optional: LAYA_MODEL=/path/Laya-Q8_0.gguf copies the model into
# the app container so the on-device decision model runs in the simulator (CPU).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/report/v0/site/screenshots"
DD="${DERIVED_DATA:-$ROOT/apps/ios/.derived}"
DEVICE="${DEVICE:-iPhone 17}"
mkdir -p "$OUT"

cd "$ROOT/apps/ios"
xcodegen generate >/dev/null
xcodebuild -project WeeHours.xcodeproj -scheme App -destination "platform=iOS Simulator,name=$DEVICE" -derivedDataPath "$DD" \
  build CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO -quiet
SIM=$(xcrun simctl list devices available | grep "$DEVICE (" | head -1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')
xcrun simctl boot "$SIM" 2>/dev/null || true
xcrun simctl status_bar "$SIM" override --time "3:12" --batteryLevel 64 --wifiBars 3 2>/dev/null || true
xcrun simctl uninstall "$SIM" com.hejitech.weehours 2>/dev/null || true
xcrun simctl install "$SIM" "$DD/Build/Products/Debug-iphonesimulator/WeeHours.app"

BACKEND="Keyword fallback"
if [[ -n "${LAYA_MODEL:-}" ]]; then
  DATA=$(xcrun simctl get_app_container "$SIM" com.hejitech.weehours data)
  mkdir -p "$DATA/Library/Application Support/models"
  cp "$LAYA_MODEL" "$DATA/Library/Application Support/models/Laya-Q8_0.gguf"
  BACKEND="On-device Laya"
fi

shot() {  # name, extra launch args…
  local name=$1; shift
  xcrun simctl launch --terminate-running-process "$SIM" com.hejitech.weehours \
    -autoSignIn parent1@example.com -skipPermissions YES -decisionBackend "$BACKEND" "$@" >/dev/null
  sleep "${WAIT:-12}"
  # simctl may not write outside temp locations, so capture there and move
  local tmp; tmp="$(mktemp -d)/shot.png"
  xcrun simctl io "$SIM" screenshot "$tmp" >/dev/null 2>&1
  mv "$tmp" "$OUT/ios-$name.png"
  echo "  ios-$name.png"
}

shot home
WAIT=25 shot review -demoText "finished, a quarter left" -screen review
shot timeline -screen timeline
shot settings -screen settings
shot paywall -screen paywall
shot agents -screen agents
xcrun simctl status_bar "$SIM" clear 2>/dev/null || true
