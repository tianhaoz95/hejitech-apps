#!/usr/bin/env bash
# App Store screenshots for a HEJI iOS app, taken in simulators from a Debug build against the local
# stack (demo data only), with a clean status bar and no taps: each shot is one launch with the
# app's own Debug launch arguments. Per-project shot lists are below.
#
#   scripts/store_screenshots.sh tradeboard   # needs the local Tradeboard Worker (npm run dev:worker -w @tradeboard/web)
#   scripts/store_screenshots.sh g2digest     # needs the local G2 Digest Worker with an edition published
#                                              # (scripts/publish-bundle.mjs with the 2026-10-22 fixture)
#
# Output: projects/<name>/apps/ios/AppStore/screenshots/<iphone-6.9|ipad-13>/NN-<shot>.png, which
# scripts/upload_store_screenshots.mjs sends to App Store Connect.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${1:?usage: store_screenshots.sh <tradeboard|g2digest>}"

IPHONE="${IPHONE_SIM:-iPhone 18 Pro Max}"   # 6.9": 1320 x 2868
IPAD="${IPAD_SIM:-iPad Pro 13-inch (M5)}"   # 13": 2064 x 2752

udid() { xcrun simctl list devices available -j | node -e 'const d=JSON.parse(require("fs").readFileSync(0)).devices;for(const l of Object.values(d))for(const x of l)if(x.name===process.argv[1]){console.log(x.udid);process.exit(0)}process.exit(1)' "$1"; }

case "$PROJECT" in
  tradeboard)
    IOS=projects/tradeboard/apps/ios; SCHEME_PROJ=Tradeboard.xcodeproj; APP_NAME=Tradeboard; BUNDLE=com.hejitech.tradeboard
    DEVICES=("$IPHONE" "$IPAD")
    defaults_for() { echo "last_seen_whats_new_version_tradeboard $(grep -oE 'currentVersion = "[0-9.]+"' "$IOS/App/Sources/WhatsNewView.swift" | grep -oE '[0-9.]+')"; }
    # name|launch arguments (each launch signs in to the local App Review demo board, reset each time)
    SHOTS=(
      "board|-reviewSignIn"
      "ready-plan|-reviewSignIn -openPlan ready"
      "ready-discussion|-reviewSignIn -openPlan ready -planTab 1"
      "open-question|-reviewSignIn -openPlan debated -planTab 1"
    )
    ;;
  g2digest)
    IOS=projects/g2digest/apps/ios; SCHEME_PROJ=G2Digest.xcodeproj; APP_NAME=G2Digest; BUNDLE=com.hejitech.g2digest
    DEVICES=("$IPHONE")
    defaults_for() {
      echo "last_seen_whats_new_version $(grep -oE 'currentVersion = "[0-9.]+"' "$IOS/App/Sources/WhatsNewView.swift" | grep -oE '[0-9.]+')"
      echo "g2digest_server_url http://127.0.0.1:8790"
      echo "g2digest_device_token g2d_dev_local_device"
    }
    # name|view mode|launch arguments
    SHOTS=(
      "reader|Native|-card 1"
      "glasses|G2 Glasses HUD|-card 1"
      "card|Native|-card 3"
      "glasses-card|G2 Glasses HUD|-card 3"
      "editions|Native|-showHistory"
    )
    ;;
  *) echo "no shot list for $PROJECT" >&2; exit 2 ;;
esac

echo "==> building $APP_NAME (Debug, simulator)"
(cd "$IOS" && xcodegen generate -q && xcodebuild -project "$SCHEME_PROJ" -scheme App -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .derived CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build -quiet)
APP="$(find "$IOS/.derived/Build/Products" -maxdepth 2 -name "$APP_NAME.app" | head -1)"

for DEV in "${DEVICES[@]}"; do
  ID="$(udid "$DEV")" || { echo "no simulator named $DEV" >&2; exit 1; }
  case "$DEV" in iPad*) DIR=ipad-13 ;; *) DIR=iphone-6.9 ;; esac
  OUT="$IOS/AppStore/screenshots/$DIR"; mkdir -p "$OUT"; rm -f "$OUT"/*.png
  echo "==> $DEV → $OUT"
  xcrun simctl boot "$ID" 2>/dev/null || true
  xcrun simctl bootstatus "$ID" -b >/dev/null
  xcrun simctl ui "$ID" appearance dark
  xcrun simctl status_bar "$ID" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl install "$ID" "$APP"
  # Preferences go in as launch arguments (UserDefaults' argument domain): `simctl spawn defaults`
  # doesn't reach the app container's preferences, and nothing is left behind this way.
  PREFS=()
  while read -r k v; do [ -n "$k" ] && PREFS+=("-$k" "$v"); done < <(defaults_for)
  n=0
  for s in "${SHOTS[@]}"; do
    n=$((n + 1))
    IFS='|' read -r name a b <<<"$s"
    EXTRA=()
    if [ "$PROJECT" = g2digest ]; then EXTRA=(-g2digest_view_mode "$a"); args="$b"; else args="$a"; fi
    xcrun simctl terminate "$ID" "$BUNDLE" 2>/dev/null || true
    # shellcheck disable=SC2086
    xcrun simctl launch "$ID" "$BUNDLE" "${PREFS[@]}" "${EXTRA[@]}" $args >/dev/null
    sleep "${SHOT_WAIT:-9}"
    f="$OUT/$(printf '%02d' $n)-$name.png"
    timeout 30 xcrun simctl io "$ID" screenshot "$f" >/dev/null 2>&1
    echo "    $f $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"
  done
  xcrun simctl terminate "$ID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl status_bar "$ID" clear
done
