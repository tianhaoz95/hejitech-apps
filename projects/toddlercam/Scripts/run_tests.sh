#!/bin/bash
set -e

echo "========================================="
echo "   ToddlerCam: Unit Test Suite Runner    "
echo "========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "1. Building for testing..."
xcodebuild build-for-testing \
  -project KidsCam.xcodeproj \
  -scheme KidsCam \
  -destination "generic/platform=iOS Simulator" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

echo "2. Running tests on available iOS Simulator..."
# Find booted simulator or pick first iPhone
DEVICE_ID=$(xcrun simctl list devices | grep -E "iPhone.*\(Booted\)" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID=$(xcrun simctl list devices | grep -E "iPhone 16 Pro \(" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
    xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
fi

echo "Testing on device ID: $DEVICE_ID"
xcodebuild test-without-building \
  -project KidsCam.xcodeproj \
  -scheme KidsCam \
  -destination "id=$DEVICE_ID" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

echo "========================================="
echo "   ALL UNIT TESTS PASSED!                "
echo "========================================="
