#!/usr/bin/env bash
# App Store screenshots for a HEJI iOS app, taken in simulators from a Debug build against the local
# stack (demo data only), with a clean status bar and no taps: each shot is one launch with the
# app's own Debug launch arguments. Per-project shot lists are below.
#
#   scripts/store_screenshots.sh tradeboard   # needs the local Tradeboard Worker (npm run dev:worker -w @tradeboard/web)
#   scripts/store_screenshots.sh g2digest     # needs the local G2 Digest Worker with an edition published
#                                              # (scripts/publish-bundle.mjs with the 2026-10-22 fixture)
#
# Output: projects/<name>/apps/ios/AppStore/screenshots/<iphone-6.9|ipad-13|iphone-duo>/NN-<shot>.png, which
# scripts/upload_store_screenshots.mjs sends to App Store Connect.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${1:?usage: store_screenshots.sh <tradeboard|g2digest|headway|fitloop>}"

IPHONE="${IPHONE_SIM:-iPhone 18 Pro Max}"   # 6.9": 1320 x 2868
IPAD="${IPAD_SIM:-iPad Pro 13-inch (M5)}"   # 13": 2064 x 2752
DUO="${DUO_SIM:-iPhone Duo}"                # inner (unfolded) 2853 x 2007 landscape; outer 1398 x 2034
# iPhone Duo: simctl can't fold or unfold it, so unfold it in Device Hub first (Device Hub's fold
# control). DUO_DISPLAY=outer shoots the cover screen instead.
duo_display() { xcrun simctl io "$1" enumerate | awk -v outer="$([ "${DUO_DISPLAY:-inner}" = outer ] && echo 1 || echo 0)" \
  '/UUID:/{u=$2} /Default width:/{w=$3; if((outer && w==1398) || (!outer && (w==2007 || w==2853))){print u; exit}}'; }

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
  headway)
    # Needs the local Headway Worker (npm run dev:worker -w @headway/web) with its demo clock on a weekday
    # morning (PUT /api/dev/clock) and, for the Family shot, the seed rider in a group whose members share.
    IOS=projects/headway/apps/ios; SCHEME_PROJ=Headway.xcodeproj; APP_NAME=Headway; BUNDLE=com.hejitech.headway
    DEVICES=("$IPHONE" "$IPAD" "$DUO")
    defaults_for() { echo "last_seen_whats_new_version $(grep -oE 'currentVersion = "[0-9.]+"' "$IOS/App/Sources/WhatsNewView.swift" | grep -oE '[0-9.]+')"; }
    # name|launch arguments (the seed rider on the local stack)
    SHOTS=(
      "trains|-autoSignIn -screen trains"
      "commute|-autoSignIn -screen commute"
      "family|-autoSignIn -screen family"
      "settings|-autoSignIn -screen settings"
    )
    ;;
  fitloop)
    # Needs the local FitLoop Worker (npm run dev:worker -w @fitloop/web) and the seeded athlete
    # (supabase/seeds/fitloop.sql: the plan follows the current week).
    IOS=projects/fitloop/apps/ios; SCHEME_PROJ=FitLoop.xcodeproj; APP_NAME=FitLoop; BUNDLE=com.hejitech.fitloop
    DEVICES=("$IPHONE" "$IPAD" "$DUO")
    defaults_for() { echo "last_seen_whats_new_version $(grep -oE 'currentVersion = "[0-9.]+"' "$IOS/App/Sources/WhatsNewView.swift" | grep -oE '[0-9.]+')"; }
    # name|launch arguments (the seeded athlete on the local stack; -noHealth skips the Health prompt)
    SHOTS=(
      "today|-autoSignIn -noHealth -screen today"
      "workout|-autoSignIn -noHealth -screen today -openWorkout"
      "plan|-autoSignIn -noHealth -screen plan"
      "progress|-autoSignIn -noHealth -screen progress"
      "feedback|-autoSignIn -noHealth -screen feedback"
    )
    ;;
  *) echo "no shot list for $PROJECT" >&2; exit 2 ;;
esac

# SHOT_DEVICES="iPad Pro 13-inch (M5)" (comma-separated) retakes only those devices.
if [ -n "${SHOT_DEVICES:-}" ]; then IFS=',' read -r -a DEVICES <<<"$SHOT_DEVICES"; fi

echo "==> building $APP_NAME (Debug, simulator)"
(cd "$IOS" && xcodegen generate -q && xcodebuild -project "$SCHEME_PROJ" -scheme App -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .derived CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build -quiet)
APP="$(find "$IOS/.derived/Build/Products" -maxdepth 2 -name "$APP_NAME.app" | head -1)"

for DEV in "${DEVICES[@]}"; do
  ID="$(udid "$DEV")" || { echo "no simulator named $DEV" >&2; exit 1; }
  case "$DEV" in iPad*) DIR=ipad-13 ;; *Duo*) DIR=iphone-duo ;; *) DIR=iphone-6.9 ;; esac
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
    xcrun simctl launch "$ID" "$BUNDLE" ${PREFS[@]+"${PREFS[@]}"} ${EXTRA[@]+"${EXTRA[@]}"} $args >/dev/null
    sleep "${SHOT_WAIT:-9}"
    f="$OUT/$(printf '%02d' $n)-$name.png"
    if [ "$DIR" = iphone-duo ]; then
      timeout 30 xcrun simctl io "$ID" screenshot --display="$(duo_display "$ID")" "$f" >/dev/null 2>&1
    else
      timeout 30 xcrun simctl io "$ID" screenshot "$f" >/dev/null 2>&1
    fi
    echo "    $f $(sips -g pixelWidth -g pixelHeight "$f" | awk '/pixel/{printf "%s ", $2}')"
  done
  xcrun simctl terminate "$ID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl status_bar "$ID" clear
done
