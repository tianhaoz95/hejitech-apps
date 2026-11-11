#!/bin/bash
# Screenshot the connected Android phone (or emulator) to a PNG you can look at.
#
#   .claude/skills/heji-android-app/shot.sh <out.png> [max-size-px]
#
# `adb exec-out screencap -p > file` breaks on phones with more than one display (a warning lands in
# the PNG), so this captures on the device and pulls the file. The image is scaled so its longest side
# is max-size-px (default 1300); multiply a point in it by (device height / image height) to tap it.
set -euo pipefail
OUT="${1:?usage: shot.sh <out.png> [max-size-px]}"
MAX="${2:-1300}"
adb shell screencap -p /sdcard/.heji_shot.png >/dev/null 2>&1
adb pull /sdcard/.heji_shot.png "$OUT" >/dev/null
adb shell rm -f /sdcard/.heji_shot.png
sips -Z "$MAX" "$OUT" >/dev/null 2>&1 || true
echo "$OUT ($(adb shell wm size | tr -d '\r' | sed 's/.*: //') on the device)"
