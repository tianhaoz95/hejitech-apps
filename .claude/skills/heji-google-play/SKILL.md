---
name: heji-google-play
description: Take a HEJI project's Android app from no Google Play presence to CI uploads on the internal testing track -- create the app in the HEJI TECH LLC Play Console through Claude in Chrome, make the upload keystore with Android Studio's keytool (kept in ~/Credentials/<project>/), build a shrunk signed bundle that meets Play's target-API rule, do the first upload and internal release by hand (the API can't), set up the tester list, grant the shared play-publisher service account the app, add GitHub secrets and a <project>-play-internal.yml workflow started by cut_release.sh, and check it all with play.mjs, a dependency-free Play Developer API client. Use when asked to "put the Android app on Google Play", "create the app in Play Console", "set up internal testing", "upload to Play from CI", "make a signing key / upload key", "Play Store release workflow", or when a project's Android app has never shipped.
---

# Google Play: app, upload key, internal testing, CI

Done for FitLoop (2026-11-10) and Headway (2026-11-11); this is those runs, generalised. Building and
testing the app itself: skill `heji-android-app`. `<name>` is the project
(`projects/<name>/`), `<pkg>` its `applicationId` (`com.hejitech.<name>`), `<NAME>` the upper-case
secret prefix. Read the root `CLAUDE.md` first (isolation, releases).

## What exists already (shared, don't recreate)

- **Play Console:** HEJI TECH LLC, organization account, developer ID `7637681845911355660`, signed in
  on the owner's Chrome (tianhaozhou.dev@gmail.com). Use **Claude in Chrome**; the built-in browser
  isn't signed in. Home: `https://play.google.com/console/u/0/developers/7637681845911355660/home`.
- **Upload service account:** `play-publisher@heji-play-publishing.iam.gserviceaccount.com` in GCP
  project `heji-play-publishing` (Google Play Android Developer API enabled, no IAM roles). Key:
  `~/Credentials/heji-play-publisher.json`; GitHub secret `PLAY_SERVICE_ACCOUNT_JSON` (team-wide,
  allowed by `scripts/check_isolation.mjs` like the Apple secrets). It only reaches apps granted
  to it in the Play Console. Contempo has its own older account (`contempo-str` project): leave it.
- **Tester list:** "HEJI owner" (tianhaozhou.dev@gmail.com, jacksonzhou666@gmail.com). Email lists
  are account-wide; reuse it. Don't add the "Developers"/"Friends" lists without asking.

## Ask the owner first (once, together)

- The two **declarations** on Create app (Developer Program Policies, US export laws): accepting
  them is the owner's call.
- Anything that **downloads a key** (a new service-account key, if the shared one is ever replaced).

Everything else in this flow is pre-approved by "set up Google Play for <name>".

Say before you start what testers will get: an app whose only sign-in is a debug button ships as
public screens only (Headway's first upload did). The owner may want real sign-in first.

**Order that worked** (one sitting, about an hour): 1 app record → 2 upload key and GitHub secrets →
3 Gradle (target API, R8, signing, version) with a `-PminifyDebug` run on the phone → 4 hand upload
to internal testing → 5 service account → 6 workflow and `release.env` → commit, push, wait for CI →
`scripts/cut_release.sh <name>` ships the next version through CI. Steps 1 and 2 can overlap (Play
takes a few seconds to create the app).

## Steps

### 1. App record (Play Console, Chrome)

`…/developers/7637681845911355660/create-new-app`: App name, **Package name** (the form takes it
now; press *Check availability*), language en-US, App, Free (free can't become paid later), leave
automatic protection on, tick both declarations (owner OK), *Create app*. Note the app ID from the
URL (`/app/<id>/app-dashboard`) for the workflow's environment URL.

- The name is not unique on Play, but keep it in step with the App Store one or use
  `<Name>: <short descriptor>` (Headway is "Headway: Caltrain Alerts"), at most 30 characters.
- The radios and checkboxes are not in the accessibility tree: click them from a screenshot. Choosing
  *Free* inserts a box and **moves the declarations down**, so scroll and take a new screenshot before
  ticking them, then zoom in to confirm both are ticked before *Create app*.

### 2. Upload key (Android Studio's keytool)

```sh
D=~/Credentials/<name>; mkdir -p $D && chmod 700 $D          # never overwrite an existing keystore
PW=$(openssl rand -base64 30 | tr -dc 'A-Za-z0-9' | head -c 32)
"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -genkeypair \
  -keystore $D/android-upload-keystore.jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 4096 \
  -validity 10000 -storepass "$PW" -keypass "$PW" -dname "CN=HEJI TECH LLC, O=HEJI TECH LLC, C=US"
```

Then put the three values in GitHub secrets at once (step 6's commands): credentials always go to
`~/Credentials` **and** GitHub secrets in the same sitting.

Write `$D/android-upload.env` (`chmod 600`) with `<NAME>_ANDROID_KEYSTORE=…`,
`<NAME>_ANDROID_KEYSTORE_PASSWORD=…`, `<NAME>_ANDROID_KEY_ALIAS=upload`. Play App Signing keeps the
real signing key; this is only the upload key (Google can reset it if lost). Never commit either.

### 3. The app's Gradle setup

Model: `projects/fitloop/apps/android/app/build.gradle.kts`.
- `release` signs from the env vars above when `<NAME>_ANDROID_KEYSTORE` is set; `versionCode` from
  `-PversionCode=`; `versionName` from the iOS `MARKETING_VERSION` (one version per project).
- **Target API:** Play rejects new apps and updates below its current level (API 36 in Nov 2026:
  "must target at least API level 36"). `compileSdk`/`targetSdk = 36` needs AGP ≥ 8.10 (8.10.1 works
  with Gradle 8.11.1 and Kotlin 2.0.20). Check Play's current rule before building.
- **R8:** `isMinifyEnabled = true`, `isShrinkResources = true`, `proguard-rules.pro` keeping the
  `@Serializable` models. It cut FitLoop's bundle from 11 MB to 3.6 MB, which also matters because
  Claude in Chrome's `file_upload` takes at most 10 MB. A `-PminifyDebug` switch builds a shrunk
  **debug** app: test that against the local stack (sign in, a check-in, a settings save, a restart)
  before uploading, since R8 breaks JSON mapping silently if the keep rules are wrong.
- **Release lint** runs in `bundleRelease` and fails the build: `InvalidFragmentVersionForActivityResult`
  (Play services or Firebase pull in an old Fragment while the app uses permission launchers) is fixed
  by depending on `androidx.fragment:fragment` 1.8+.
- `versionCode = minutes since 2020-01-01 UTC`: `$(( ($(date -u +%s) - 1577836800) / 60 ))`. Always
  rising, the same scheme by hand and in CI, far below Play's 2.1 billion limit.

```sh
cd projects/<name>/apps/android && set -a && . ~/Credentials/<name>/android-upload.env && set +a
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
  ./gradlew :app:bundleRelease -PversionCode=$(( ($(date -u +%s) - 1577836800) / 60 ))
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab | grep SHA256  # = the upload key
```

### 4. Internal testing track and the first release (by hand: the API can't make an app's first upload)

`…/app/<id>/tracks/internal-testing`:
1. **Testers** tab: tick "HEJI owner" (or *Create email list*), *Save*.
2. *Create new release*: `find` the hidden file input in "Upload app bundles" and `file_upload` the
   `.aab` (don't click Upload: it opens a native picker). Wait ~30 s for processing.
3. Release notes in the `<en-US>…</en-US>` box. The release *name* is suggested from the first
   bundle and doesn't change if you swap bundles; that's cosmetic (check *Show summary* for the
   version code that actually shipped).
4. *Next*: fix every **error** (a target-API error means step 3's rule; rebuild, remove the old
   bundle from the draft via its ⋮ menu, upload again). The "native code … debug symbols" warning is
   fine. *Save and publish* → confirm. The track shows "Active · Available to internal testers".

Testers join at the track's "Join on the web" link (Testers tab), then install from Play.

The hand upload carries whatever `MARKETING_VERSION` says today (Headway's was 1.2.2 while 1.3.0 was
being cut); the release that follows uploads the new version through CI, which is fine.

### 5. Give the service account the app

The account is already a user, so don't invite it again: `…/users-and-permissions` → its row →
*Manage* → *Add app* → tick the new app only → *Apply* → in the permissions sheet keep the read-only
defaults and tick **Release apps to testing tracks** (never "Release to production") → *Apply* →
*Save changes* → *Yes*. It's active at once. (Only a brand-new service account goes through
`…/users-and-permissions/invite` with the same choices, then *Invite user*, *Send invite*.)

Changing who may release an app is the owner's call: if the session's permission check stops the
*Apply* click, ask the owner and retry once they say so, rather than leaving the workflow to fail.

```sh
node .claude/skills/heji-google-play/play.mjs check <pkg>    # lists each track; changes nothing
```

### 6. Secrets and the workflow

```sh
set -a && . ~/Credentials/<name>/android-upload.env && set +a
base64 -i "$<NAME>_ANDROID_KEYSTORE" | gh secret set <NAME>_ANDROID_KEYSTORE_BASE64
printf %s "$<NAME>_ANDROID_KEYSTORE_PASSWORD" | gh secret set <NAME>_ANDROID_KEYSTORE_PASSWORD
printf %s "$<NAME>_ANDROID_KEY_ALIAS" | gh secret set <NAME>_ANDROID_KEY_ALIAS
# PLAY_SERVICE_ACCOUNT_JSON is already set (shared).
```

Copy `.github/workflows/fitloop-play-internal.yml` to `<name>-play-internal.yml` and rename the
tag prefix, paths, package, secrets and the environment URL's app ID. It runs on a published
`<name>-v*` release and from the Actions tab, verifies the tag against `MARKETING_VERSION`, runs the
core tests, builds the signed bundle and rolls it out to `internal` with
`r0adkll/upload-google-play@v1` (`status: completed`, the R8 mapping file attached).

In `projects/<name>/release.env`: add the workflow to `RELEASE_WORKFLOWS` and the four secrets to
`REQUIRED_SECRETS`. Then `node scripts/check_isolation.mjs`. Also update the root `CLAUDE.md`
"Releases" paragraph for the project, and the project's `CLAUDE.md` (Play app name, package, app ID,
where the key is).

### 7. Prove it

Commit and push (owner's OK), then `gh workflow run <name>-play-internal.yml --ref main` and watch
it (`gh run watch`), or cut the next release if one is due. Done means the run is green **and**
`play.mjs check <pkg>` shows the new version code on `internal`. Afterwards,
`scripts/cut_release.sh <name>` ships Android with the rest.

`cut_release.sh` wants a clean tree and green CI. An untracked file anywhere in the repo stops it:
commit or ignore the file (ask whose it is); don't reach for `--force`, which also skips the CI check.
A red CI run whose log says a port was "already in use" when starting Supabase is the runner's fault:
`gh run rerun <id> --failed`.

### Wear OS apps (TinyTouch, ToddlerCam, 2026-11-11)

A watch app goes in the **same** Play app as the phone app, never a listing of its own:
- **Same `applicationId`** on phone and watch (the Wear Data Layer needs it too; ToddlerCam's watch
  used `….wear` and had to change). Code namespaces may differ.
- **Different version codes:** the watch module uses the phone's `-PversionCode` plus one
  (`versionCode = (findProperty("versionCode") as String?)?.toInt()?.plus(1) ?: 1`).
- **Form factor:** Test and release → Advanced settings → *Form factors* → *Add form factor* →
  *Wear OS*. That creates Wear-only tracks: the form-factor selector at the top of a track page
  switches to *Wear OS only*, which has its **own testers** (tick "HEJI owner" there too) and its own
  first hand upload. The opt-in/review step there only matters for production.
- **API track names** are `wear:internal`, `wear:beta`, `wear:production` (`play.mjs check` lists
  them). The workflow uploads the phone bundle to `internal` and the watch bundle to
  `wear:internal` in two `r0adkll/upload-google-play` steps. Models:
  `.github/workflows/tinytouch-play-internal.yml`, `toddlercam-play-internal.yml`.
- Wear modules need `uses-feature android.hardware.type.watch` and the
  `com.google.android.wearable.standalone` meta-data; target API 36 like the phone.

### Promo video (store listing)

Play takes only a YouTube link (Main store listing → Video), public or **unlisted**, ads off; landscape
reads best. Headway and FitLoop's (2026-11-13) are the Android Debug app on the emulator with the local
stack: `branding/promo-videos/scripts/play-video-record.mjs <p>` (adb screenrecord; same demo data as
the App Store previews, `app-preview-stage.mjs`), edited as the 1920x1080 compositions `<p>-play` in
`branding/promo-videos/src/app-preview`, re-encoded to H.264 high + 256k AAC, uploaded unlisted to the
HEJI TECH channel through Claude in Chrome (`youtube-channel` memory). Show the Android app, not iPhone
footage. Studio's daily upload limit drops an upload silently at the Visibility step ("Daily upload
limit reached"): check the channel's video list before taking the link.

## Pitfalls seen

- `~/Downloads` is behind macOS privacy: a sandboxed shell hangs listing it. Move a downloaded key
  with an unsandboxed command; the owner may have to approve a "Downloads folder" prompt.
- `chrome://` pages can't be opened through Claude in Chrome.
- Google Cloud's new-project form needs ~10 s before the project is usable; open
  `apis/library/androidpublisher.googleapis.com?project=<id>` afterwards and *Enable*.
- Gradle needs JDK 17 (`/opt/homebrew/opt/openjdk@17`); Android Studio's bundled JDK is too new
  for Gradle 8.11, but its `keytool`/`jarsigner` are fine.
- `adb shell pm grant` is blocked on OnePlus/OPPO phones; the app asks for notifications itself.
- Pushing `main` doesn't always start Cloudflare's Workers Build for the project: after a release,
  check the commit for a "Workers Builds: <name>" check or `wrangler deployments list`, and tell the
  owner if the Worker is stale (a hand deploy is their call).
