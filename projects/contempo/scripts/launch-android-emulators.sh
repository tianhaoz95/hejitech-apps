#!/usr/bin/env bash
# Utility script to launch Android phone and Wear OS emulator(s) (AVDs).
#
# Searches for installed AVDs, boots the selected phone and/or Wear OS emulators,
# and waits for them to complete booting over ADB.
#
# Usage: ./scripts/launch-android-emulators.sh [options]
#   --phone [avd_name]      : launch phone emulator (default: first non-wear AVD).
#   --wear, --wear-os [name]: launch Wear OS emulator (default: first wear AVD).
#   --list                  : list available AVDs and exit.
#   --no-window, --headless : run emulators without GUI window.
#   --wipe-data             : wipe emulator user data on startup.
#   -h, --help              : show this help message.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

LAUNCH_PHONE=true
LAUNCH_WEAR=true
WANT_PHONE_ONLY=false
WANT_WEAR_ONLY=false
SPECIFIED_PHONE_AVD=""
SPECIFIED_WEAR_AVD=""
HEADLESS=false
WIPE_DATA=false

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

show_help() {
  cat <<'EOF'
Usage: ./scripts/launch-android-emulators.sh [options]

Utility script to launch Android phone and Wear OS emulators (AVDs).

Options:
  --phone [avd_name]         Launch phone emulator (optionally specify AVD name).
  --wear, --wear-os [name]   Launch Wear OS emulator (optionally specify AVD name).
  --list                     List all installed AVDs and exit.
  --no-window, --headless    Run emulator(s) in headless mode (no GUI window).
  --wipe-data                Wipe user data on emulator boot.
  -h, --help                 Show this help message and exit.

Examples:
  ./scripts/launch-android-emulators.sh
  ./scripts/launch-android-emulators.sh --phone
  ./scripts/launch-android-emulators.sh --wear
  ./scripts/launch-android-emulators.sh --phone Pixel_8_API_34 --wear Wear_OS_4
EOF
  exit 0
}

# --- locate SDK tools --------------------------------------------------------
EMULATOR=""
ADB=""

if command -v emulator >/dev/null 2>&1; then
  EMULATOR="$(command -v emulator)"
elif [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/emulator/emulator" ]]; then
  EMULATOR="$ANDROID_HOME/emulator/emulator"
elif [[ -n "${ANDROID_SDK_ROOT:-}" && -x "$ANDROID_SDK_ROOT/emulator/emulator" ]]; then
  EMULATOR="$ANDROID_SDK_ROOT/emulator/emulator"
elif [[ -x "/Volumes/DEV/Library/Android/sdk/emulator/emulator" ]]; then
  EMULATOR="/Volumes/DEV/Library/Android/sdk/emulator/emulator"
elif [[ -x "$HOME/Library/Android/sdk/emulator/emulator" ]]; then
  EMULATOR="$HOME/Library/Android/sdk/emulator/emulator"
fi

if command -v adb >/dev/null 2>&1; then
  ADB="$(command -v adb)"
elif [[ -n "${ANDROID_HOME:-}" && -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  ADB="$ANDROID_HOME/platform-tools/adb"
elif [[ -n "${ANDROID_SDK_ROOT:-}" && -x "$ANDROID_SDK_ROOT/platform-tools/adb" ]]; then
  ADB="$ANDROID_SDK_ROOT/platform-tools/adb"
elif [[ -x "/Volumes/DEV/Library/Android/sdk/platform-tools/adb" ]]; then
  ADB="/Volumes/DEV/Library/Android/sdk/platform-tools/adb"
elif [[ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]]; then
  ADB="$HOME/Library/Android/sdk/platform-tools/adb"
elif [[ -f "$ANDROID_DIR/local.properties" ]]; then
  SDK_DIR="$(sed -n 's/^sdk.dir=//p' "$ANDROID_DIR/local.properties")"
  if [[ -x "$SDK_DIR/platform-tools/adb" ]]; then
    ADB="$SDK_DIR/platform-tools/adb"
  fi
  if [[ -z "$EMULATOR" && -x "$SDK_DIR/emulator/emulator" ]]; then
    EMULATOR="$SDK_DIR/emulator/emulator"
  fi
fi

if [[ -z "$EMULATOR" ]]; then
  warn "Could not find Android emulator binary. Ensure Android SDK is installed and ANDROID_HOME is set."
  exit 1
fi

if [[ -z "$ADB" ]]; then
  warn "Could not find adb binary."
  exit 1
fi

# --- parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --phone)
      WANT_PHONE_ONLY=true
      if [[ -n "${2:-}" && "$2" != --* ]]; then
        SPECIFIED_PHONE_AVD="$2"
        shift
      fi
      shift
      ;;
    --wear|--wear-os)
      WANT_WEAR_ONLY=true
      if [[ -n "${2:-}" && "$2" != --* ]]; then
        SPECIFIED_WEAR_AVD="$2"
        shift
      fi
      shift
      ;;
    --list)
      log "Installed AVDs:"
      "$EMULATOR" -list-avds || echo "No AVDs found."
      exit 0
      ;;
    --no-window|--headless)
      HEADLESS=true
      shift
      ;;
    --wipe-data)
      WIPE_DATA=true
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

if [[ "$WANT_PHONE_ONLY" == "true" && "$WANT_WEAR_ONLY" != "true" ]]; then
  LAUNCH_WEAR=false
elif [[ "$WANT_WEAR_ONLY" == "true" && "$WANT_PHONE_ONLY" != "true" ]]; then
  LAUNCH_PHONE=false
fi

# --- discover available AVDs -------------------------------------------------
ALL_AVDS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && ALL_AVDS+=("$line")
done < <("$EMULATOR" -list-avds 2>/dev/null || true)

if [[ ${#ALL_AVDS[@]} -eq 0 ]]; then
  warn "No Android Virtual Devices (AVDs) found!"
  echo "Use Android Studio Device Manager or `avdmanager create avd` to create phone/wear emulators."
  exit 1
fi

PHONE_AVDS=()
WEAR_AVDS=()

for avd in "${ALL_AVDS[@]}"; do
  if echo "$avd" | grep -i -E "wear|watch" >/dev/null; then
    WEAR_AVDS+=("$avd")
  else
    PHONE_AVDS+=("$avd")
  fi
done

SELECTED_PHONE_AVD=""
SELECTED_WEAR_AVD=""

if [[ "$LAUNCH_PHONE" == "true" ]]; then
  if [[ -n "$SPECIFIED_PHONE_AVD" ]]; then
    SELECTED_PHONE_AVD="$SPECIFIED_PHONE_AVD"
  elif [[ ${#PHONE_AVDS[@]} -gt 0 ]]; then
    SELECTED_PHONE_AVD="${PHONE_AVDS[0]}"
  else
    warn "No phone AVD found in available AVDs: ${ALL_AVDS[*]}"
    if [[ "$WANT_PHONE_ONLY" == "true" ]]; then exit 1; fi
    LAUNCH_PHONE=false
  fi
fi

if [[ "$LAUNCH_WEAR" == "true" ]]; then
  if [[ -n "$SPECIFIED_WEAR_AVD" ]]; then
    SELECTED_WEAR_AVD="$SPECIFIED_WEAR_AVD"
  elif [[ ${#WEAR_AVDS[@]} -gt 0 ]]; then
    SELECTED_WEAR_AVD="${WEAR_AVDS[0]}"
  else
    echo "  No Wear OS AVD found — skipping watch emulator"
    if [[ "$WANT_WEAR_ONLY" == "true" ]]; then exit 1; fi
    LAUNCH_WEAR=false
  fi
fi

if [[ "$LAUNCH_PHONE" != "true" && "$LAUNCH_WEAR" != "true" ]]; then
  warn "No emulators to launch."
  exit 1
fi

# --- launch function ---------------------------------------------------------
launch_avd() {
  local avd_name="$1"
  local extra_flags=()
  if [[ "$HEADLESS" == "true" ]]; then
    extra_flags+=("-no-window")
  fi
  if [[ "$WIPE_DATA" == "true" ]]; then
    extra_flags+=("-wipe-data")
  fi

  log "Launching emulator for AVD '$avd_name'..."
  "$EMULATOR" -avd "$avd_name" "${extra_flags[@]:-}" >/dev/null 2>&1 &
  local pid=$!
  echo "  started background process (PID $pid)"
}

# --- launch requested emulators ----------------------------------------------
"$ADB" start-server >/dev/null 2>&1 || true

if [[ "$LAUNCH_PHONE" == "true" && -n "$SELECTED_PHONE_AVD" ]]; then
  launch_avd "$SELECTED_PHONE_AVD"
fi

if [[ "$LAUNCH_WEAR" == "true" && -n "$SELECTED_WEAR_AVD" ]]; then
  launch_avd "$SELECTED_WEAR_AVD"
fi

log "Emulators launched. Run '$ADB devices' to verify when boot finishes."
