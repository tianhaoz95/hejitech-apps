---
name: heji-app-store-connect
description: Take a HEJI project's iOS app from no App Store Connect presence to TestFlight and a filled-in App Store draft, without the owner -- register the bundle id by API, create the app record in App Store Connect via the Mac's signed-in Safari (the API can't create apps; a taken name becomes "<Name>: <descriptor>"), put the first build on TestFlight through cut_release.sh, add the owner's tester address to an internal group and send the invite, then write the store listing (text, URLs, categories, age rating, price, availability, review details) by API, leaving only what Apple keeps to the owner. Includes asc.mjs, a dependency-free App Store Connect API client. Use when asked to "create the app in App Store Connect", "publish the iOS app", "get it on TestFlight", "set up the App Store listing", "fill in the store information", "add me as a tester", or when a project's iOS app has never shipped.
---

# App Store Connect: new app → TestFlight → store draft

Rules from the root `CLAUDE.md` ("New App Store Connect apps"): do it yourself; a taken name
becomes `<Name>: <short descriptor>` (≤ 30 characters) without asking; every new app gets
`tianhaozhou95@icloud.com` as a TestFlight tester with the invite sent. Never submit for review,
set a price other than free, or accept an agreement: those are the owner's.

The client (all steps below use it; credentials come from the shell profile):

```sh
source ~/.config/heji/machine-env.zsh          # FA_ASC_KEY_ID / FA_ASC_ISSUER_ID
A=.claude/skills/heji-app-store-connect/asc.mjs
node $A status com.hejitech.<slug>             # where things stand; exit 3 = no app record yet
node $A GET 'v1/apps?filter[bundleId]=com.hejitech.<slug>'   # any call: GET|POST|PATCH|DELETE path [body.json|-]
```

## 0. Check the app first

The app should build and run before it gets a record. Release plumbing per project (copy the
newest iOS project's, e.g. Tether or Tradeboard): `scripts/release_testflight.sh`,
`scripts/asc_build_status.swift`, `.github/workflows/<name>-testflight.yml` with the Wednesday
`schedule:` 15 minutes after the latest one (`grep -h cron: .github/workflows/*testflight*`),
`release.env` with `RELEASE_WORKFLOWS`, the signing `REQUIRED_SECRETS` and the What's New
`release_check`. Test on the attached iPhone (see Pitfalls for signing hangs).

## 1. Bundle id (API)

```sh
node $A register-bundle com.hejitech.<slug> <Name>      # idempotent
```

Extensions (watch app, widgets) register themselves at archive time. App Groups do not: they
break CI signing (`ci-signing-app-groups` memory); use `keychain-access-groups` instead.

## 2. App record (Safari; the API has no create)

Needs computer-use or browser tools (`ToolSearch` "computer", then "browser"). If the session has
neither, do every other step and tell the owner the one thing left, with the exact values below.

appstoreconnect.apple.com → Apps → **+** → New App:

| Field | Value |
| --- | --- |
| Platforms | iOS (plus macOS etc. only if the project ships them) |
| Name | the product name; if "already being used", `<Name>: <descriptor>` ≤ 30 chars, e.g. `Tether: External Workspace`, `FitLoop: Workout Companion` |
| Primary Language | English (U.S.) |
| Bundle ID | `com.hejitech.<slug>` (appears after step 1) |
| SKU | the bundle id |
| User Access | Full Access |

A sign-in or 2FA prompt is the only reason to stop and ask. Confirm with `node $A status …`.

## 3. First build on TestFlight

`scripts/cut_release.sh <project> --dry-run`, then for real (`--watch`). The upload alone proves
nothing: the release script's `asc_build_status.swift` waits for `VALID`/`FAILED`, and
`node $A status` lists builds with their `processingState`.

## 4. Tester + invite

```sh
node $A invite-tester com.hejitech.<slug> tianhaozhou95@icloud.com     # group "Team", internal
```

That address is an Admin on the team, so an internal group works: every build at once, no Beta App
Review. Adding the tester works before any build (the script creates the tester with the group
attached; linking an existing tester record to the group is refused with 409 "Tester(s) cannot be
assigned"). Only the invitation waits for a processed build ("Tester has no installable build"):
rerun after step 3, or let the first build reach the internal group on its own.

## 5. Store draft (API)

Find the ids: `v1/apps/<app>/appInfos`, `v1/appInfos/<id>/appInfoLocalizations`,
`v1/apps/<app>/appStoreVersions`, `v1/appStoreVersions/<id>/appStoreVersionLocalizations`.
Take the text from the project (landing page, `docs/`, `review.env`), not invented claims.

| What | Call |
| --- | --- |
| Version string `1.0.0` (Apple creates `1.0`) and copyright `2026 HEJI TECHNOLOGY LLC` (what the shipped apps use) | `PATCH v1/appStoreVersions/<id>` `versionString`, `copyright` |
| Description, keywords (≤ 100 chars, commas, no spaces), promotional text, support URL, marketing URL | `PATCH v1/appStoreVersionLocalizations/<id>` |
| Subtitle (≤ 30), privacy policy URL | `PATCH v1/appInfoLocalizations/<id>` |
| Categories | `PATCH v1/appInfos/<id>` relationships `primaryCategory`/`secondaryCategory` (ids like `HEALTH_AND_FITNESS`, `PRODUCTIVITY`, `FINANCE`) |
| Age rating | `GET v1/appInfos/<id>/ageRatingDeclaration`, then `PATCH v1/ageRatingDeclarations/<id>` with every answer |
| Content rights | `PATCH v1/apps/<app>` `contentRightsDeclaration` (`DOES_NOT_USE_THIRD_PARTY_CONTENT`, or `USES_…` when it shows others' data: ask if unsure) |
| Free price | `POST v1/appPriceSchedules` with the USA price point whose `customerPrice` is `0` (`v1/apps/<app>/appPricePoints?filter[territory]=USA`) |
| Availability | `POST v2/appAvailabilities` listing **every** territory with `available` true/false |
| App Review demo account + notes | the `heji-review-account` skill (`scripts/review_account.sh <project>`); its PATCH needs the review contact's name, phone and email filled first |

Screenshots: `scripts/store_screenshots.sh <project>` takes them in simulators (6.9" iPhone 18 Pro
Max, 13" iPad Pro) from a Debug build on the local stack, one launch per shot through the app's own
Debug launch arguments (Tradeboard and G2 Digest have shot lists; add one for another app), then
`node $A upload-screenshots com.hejitech.<slug> APP_IPHONE_67 <png…>` (and `APP_IPAD_PRO_3GEN_129`
for iPad apps, 2064x2752; `APP_IPHONE_DUO` for iPhone Duo, 2853x2007 inner screen) replaces that set
and waits for Apple's COMPLETE. The owner's iPhone 13 is 6.1", too small for the required size. Look
at every shot before uploading: taking them found two real bugs.

- **iPhone Duo** (required from April 2027): the app must be built with the iOS 27.1+ SDK to use the
  unfolded display (older SDKs letterbox), so the TestFlight workflow runs on `runs-on: xcode-27` with
  `xcode-version: "27.2"`. simctl can't unfold the Duo simulator: unfold it in Device Hub (ask the owner
  if Device Hub access is refused), then `SHOT_DEVICES="iPhone Duo" scripts/store_screenshots.sh <p>`;
  the inner screen is natively landscape, and the tab bar turns vertical.
- **iPad**: `TARGETED_DEVICE_FAMILY: "1,2"` plus all four `UISupportedInterfaceOrientations~ipad`; a
  `ReadableContentWidth` modifier on the TabView (contentMargins, `nil` on iPhone — a 0 removes the
  list's own margins) keeps lists readable on iPad and the unfolded Duo. iPad screenshots only go live
  with a build that supports iPad.
- **Header and search results** (iOS 27+ product page): `node scripts/store_creatives.mjs <p>` renders
  `AppStore/creative/{header,search-results}.png` (opaque PNG, 3840x1646 and 3840x2560, key content in
  Apple's centered safe areas; `--safe` outlines them) from the brand and the iPhone shots; then
  `node $A upload-creative <bundle id> header|search <png>` uploads to the Asset Library and places it
  on the editable version (placement group `DEFAULT_PROFILE`).

## 6. Hand back

Run `node $A status …` and tell the owner what is done, and what only they can do in App Store
Connect: Paid Apps agreement / tax / banking (if not free), the App Privacy questionnaire (no API),
anything you marked as a guess (content rights, categories), and Submit for Review. For a long
list, use a `heji-report`.

## Pitfalls

- **`codesign` hangs** (build sits at `CodeSign …` forever; `timeout 25 codesign --sign <sha1> /tmp/x`
  exits 124): the login keychain won't hand the key to `codesign` without a GUI prompt. Sign with a
  throwaway keychain from `~/Credentials` and delete it afterwards:
  ```sh
  set -a; source ~/Credentials/hejitech.env; set +a
  KC=/tmp/heji-sign.keychain-db KP=$(openssl rand -hex 16)
  security create-keychain -p "$KP" $KC && security set-keychain-settings $KC && security unlock-keychain -p "$KP" $KC
  security import "$APPLE_DEV_CERT_P12_PATH" -k $KC -P "$APPLE_DEV_CERT_PASSWORD" -T /usr/bin/codesign
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KP" $KC
  # xcodebuild … OTHER_CODE_SIGN_FLAGS="--keychain $KC";  afterwards: security delete-keychain $KC
  ```
  Don't add it to the search list: the release script wants exactly one identity of each kind.
- **Device build hangs before compiling** with `-destination id=<udid>` (the phone is "preparing"):
  build `-destination generic/platform=iOS`, then `xcrun devicectl device install app --device <udid> <.app>`
  and `xcrun devicectl device process launch --device <udid> <bundle id>`.
- **No "Apple" in App Intent strings** and **a green upload isn't a build**: root `CLAUDE.md`.
- `asc.mjs` paths include the version prefix (`v1/…`, `v2/…`); quote paths with `[` `]` for zsh.
