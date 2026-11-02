# toddlercam-launch driver

XCUITest taps for `scripts/toddlercam-launch-record.mjs`: two empty host apps and a UI-test bundle each
(iOS, watchOS) whose tests drive ToddlerCam by bundle id, the way a finger would. Build it outside the
repo (XcodeGen; no signing):

```sh
cp -R branding/promo-videos/scripts/toddlercam-launch-driver <scratch>/driver && cd <scratch>/driver
xcodegen generate
xcodebuild -project TCDriver.xcodeproj -scheme DriverPhone -destination "generic/platform=iOS Simulator" -derivedDataPath dd build-for-testing
xcodebuild -project TCDriver.xcodeproj -scheme DriverWatch -destination "generic/platform=watchOS Simulator" -derivedDataPath dd build-for-testing
export TODDLERCAM_DRIVER=<scratch>/driver/dd
```
