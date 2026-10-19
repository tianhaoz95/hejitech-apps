#!/bin/bash
set -e

echo "========================================="
echo "   ToddlerCam: Automated Build Script    "
echo "========================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "1. Generating synthesized sound effects..."
python3 Scripts/generate_sounds.py

echo "2. Generating Xcode project via xcodegen..."
xcodegen generate

echo "3. Building iOS & WatchOS App (Simulator)..."
xcodebuild -project KidsCam.xcodeproj \
  -scheme KidsCam \
  -destination "generic/platform=iOS Simulator" \
  build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

echo "4. Building Watch Companion Target..."
xcodebuild -project KidsCam.xcodeproj \
  -scheme KidsCamWatch \
  -destination "generic/platform=watchOS Simulator" \
  build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

echo "5. Building Watch Complications Widget..."
xcodebuild -project KidsCam.xcodeproj \
  -scheme KidsCamWatchWidgets \
  -destination "generic/platform=watchOS Simulator" \
  build \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

echo "========================================="
echo "   BUILD SUCCEEDED FOR ALL TARGETS!      "
echo "========================================="
