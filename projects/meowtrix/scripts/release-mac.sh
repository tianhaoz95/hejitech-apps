#!/usr/bin/env bash
# Build, sign, notarize, and attach both macOS desktop editions (Lite and Standalone)
# to an existing GitHub release.
#
#   ./scripts/release-mac.sh                  # attach to the newest meowtrix-v release
#   ./scripts/release-mac.sh --tag meowtrix-v1.34.2   # a specific tag
#   ./scripts/release-mac.sh --skip-build     # reuse the bundle already built
#   ./scripts/release-mac.sh --no-upload      # build, sign, notarize only — don't attach
#   ./scripts/release-mac.sh --check          # verify credentials resolve, build nothing
#
# The release itself is created by the monorepo's scripts/cut_release.sh meowtrix -- this script
# only attaches the signed, notarized DMGs and the updater artifacts to a release that already
# exists, and refreshes the rolling meowtrix-latest release (scripts/publish-latest.sh) that
# installed desktop apps poll for latest.json.
# .github/workflows/meowtrix-mac-release.yml runs this same script in CI on `release: published`.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
# The HEJI monorepo publishes releases for several apps: Meowtrix's are meowtrix-v<version>.
REPO="${GITHUB_REPOSITORY:-tianhaoz95/hejitech-apps}"
TAG_PREFIX="meowtrix-v"
BUILD_DIR="$ROOT/build/release-mac"

TAG=""; SKIP_BUILD=0; NO_UPLOAD=0; CHECK_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag)        TAG="${2:-}"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-upload)  NO_UPLOAD=1; shift ;;
    --check)      CHECK_ONLY=1; shift ;;
    -h|--help)    sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "!! unknown argument: $1" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { echo "!! $*" >&2; exit 1; }

# ------------------------------------------------------------------ preflight
say "preflight"

IDENTITY="${FA_MAC_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null \
  | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}"
[ -n "$IDENTITY" ] || die "no \"Developer ID Application\" certificate in the keychain.
   Xcode > Settings > Accounts > your team > Manage Certificates > + .
   Only the Account Holder can create one."
echo "    identity        $IDENTITY"

# Notarization credentials
if [ -n "${FA_KEY_LOCATION:-}" ]; then
  ASC_KEY="${FA_KEY_LOCATION/#\~/$HOME}"
  ASC_KEY_ID="${FA_ASC_KEY_ID:-}"
  if [ -z "$ASC_KEY_ID" ]; then b="$(basename "$ASC_KEY")"; b="${b%.p8}"; ASC_KEY_ID="${b#AuthKey_}"; fi
else
  ASC_KEY_ID="${FA_ASC_KEY_ID:-}"
  ASC_KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID:-none}.p8"
fi
if [ -n "${FA_NOTARY_PROFILE:-}" ]; then
  echo "    notarization    keychain profile \"$FA_NOTARY_PROFILE\""
elif [ -n "$ASC_KEY_ID" ] && [ -n "${FA_ASC_ISSUER_ID:-}" ] && [ -f "$ASC_KEY" ]; then
  echo "    notarization    API key $ASC_KEY_ID"
elif [ -n "${FA_APPLE_ID:-}" ] && [ -n "${FA_APP_PASSWORD:-}" ] && [ -n "${FA_TEAM_ID:-}" ]; then
  echo "    notarization    app-specific password for $FA_APPLE_ID"
else
  die "no notarization credentials — run ./scripts/sign-desktop.sh --notarize for the setup help."
fi

TOKEN="${FA_GITHUB_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
if [ "$NO_UPLOAD" -eq 0 ] && [ "$CHECK_ONLY" -eq 0 ]; then
  command -v gh >/dev/null 2>&1 || die "gh CLI not found (needed to upload; use --no-upload to skip)"
  gh auth status >/dev/null 2>&1 || [ -n "$TOKEN" ] || die "not logged in to gh and no GH_TOKEN set"

  if [ -z "$TAG" ]; then
    # Not `gh release view` (the repo's latest release belongs to another app).
    TAG="$(gh release list --repo "$REPO" --limit 100 --exclude-drafts --exclude-pre-releases --json tagName -q '.[].tagName' 2>/dev/null \
      | grep "^$TAG_PREFIX[0-9]" | sort -V | tail -1 || true)"
    [ -n "$TAG" ] || die "no tag given and no meowtrix-v release found — pass --tag, or run scripts/cut_release.sh meowtrix first."
  fi
  echo "    release tag     $TAG"
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  say "setup looks good — run without --check to build and release"
  exit 0
fi

LITE_APP="$ROOT/src-tauri/target/release/bundle/macos/Meowtrix Lite.app"
STANDALONE_APP="$ROOT/src-tauri/target/release/bundle/macos/Meowtrix Standalone.app"

# --------------------------------------------------------------------- build
if [ "$SKIP_BUILD" -eq 0 ]; then
  say "running desktop & AI server regression tests"
  (cd "$ROOT" && cargo test --manifest-path "$ROOT/src-tauri/Cargo.toml")

  say "building Meowtrix Lite (Client Edition)"
  (cd "$ROOT" && npm run tauri build -- -c "$ROOT/src-tauri/tauri.lite.conf.json" -b app --no-sign)

  say "preparing standalone payload for Meowtrix Standalone"
  "$ROOT/scripts/prepare-standalone-payload.sh"

  say "building Meowtrix Standalone (Embedded Edition)"
  (cd "$ROOT" && npm run tauri build -- -c "$ROOT/src-tauri/tauri.standalone.conf.json" -b app --no-sign)
else
  say "skipping build"
fi

[ -d "$LITE_APP" ] || die "no app bundle at $LITE_APP — drop --skip-build"
[ -d "$STANDALONE_APP" ] || die "no app bundle at $STANDALONE_APP — drop --skip-build"

# ------------------------------------------------------- sign + notarize
mkdir -p "$BUILD_DIR/dmg"
LITE_DMG="$BUILD_DIR/dmg/Meowtrix-Lite-signed.dmg"
STANDALONE_DMG="$BUILD_DIR/dmg/Meowtrix-Standalone-signed.dmg"

say "signing and notarizing Meowtrix Lite"
"$ROOT/scripts/sign-desktop.sh" \
  --app "$LITE_APP" \
  --dmg "$LITE_DMG" \
  --volume "Meowtrix Lite" \
  --skip-updater \
  --notarize

say "signing and notarizing Meowtrix Standalone"
"$ROOT/scripts/sign-desktop.sh" \
  --app "$STANDALONE_APP" \
  --dmg "$STANDALONE_DMG" \
  --volume "Meowtrix Standalone" \
  --notarize

[ -f "$LITE_DMG" ] || die "expected artifact missing: $LITE_DMG"
[ -f "$STANDALONE_DMG" ] || die "expected artifact missing: $STANDALONE_DMG"

if [ "$NO_UPLOAD" -eq 1 ]; then
  say "done (not uploaded)"
  echo "  $LITE_DMG"
  echo "  $STANDALONE_DMG"
  exit 0
fi

# --------------------------------------------------------------- publish
VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$STANDALONE_APP/Contents/Info.plist")"
LITE_DMG_NAME="Meowtrix-Lite-$VERSION-arm64.dmg"
STANDALONE_DMG_NAME="Meowtrix-Standalone-$VERSION-arm64.dmg"

say "attaching both editions to $TAG"
[ -n "$TOKEN" ] && export GH_TOKEN="$TOKEN"

gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 \
  || die "release $TAG does not exist yet — run scripts/cut_release.sh meowtrix first"

STAGE_DIR="$(mktemp -d)"
cp "$LITE_DMG" "$STAGE_DIR/$LITE_DMG_NAME"
cp "$STANDALONE_DMG" "$STAGE_DIR/$STANDALONE_DMG_NAME"

UPLOAD_FILES=(
  "$STAGE_DIR/$LITE_DMG_NAME#$LITE_DMG_NAME"
  "$STAGE_DIR/$STANDALONE_DMG_NAME#$STANDALONE_DMG_NAME"
)

UPDATER_DIR="$ROOT/src-tauri/target/release/bundle/macos/updater"
if [ -d "$UPDATER_DIR" ]; then
  for f in "$UPDATER_DIR"/*; do
    [ -f "$f" ] && UPLOAD_FILES+=("$f")
  done
fi

say "uploading release assets"
for asset in "${UPLOAD_FILES[@]}"; do
  file_to_upload="${asset%%#*}"
  display_name="$(basename "$file_to_upload")"
  echo "==> uploading $display_name..."
  uploaded=false
  for attempt in 1 2 3 4 5; do
    if gh release upload "$TAG" --repo "$REPO" --clobber "$asset"; then
      uploaded=true
      break
    fi
    echo "    upload failed (attempt $attempt/5), retrying in 5s..."
    sleep 5
  done
  [ "$uploaded" = "true" ] || die "Failed to upload $display_name after 5 attempts"
done

say "verifying uploaded asset URLs"
for asset in "$LITE_DMG_NAME" "$STANDALONE_DMG_NAME"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -L "https://github.com/$REPO/releases/download/$TAG/$asset")"
  [ "$code" = "200" ] || die "$asset is not fetchable (got $code)"
  echo "    $code  $asset"
done

if [ -f "$UPDATER_DIR/latest.json" ]; then
  json_code="$(curl -s -o /dev/null -w '%{http_code}' -L "https://github.com/$REPO/releases/download/$TAG/latest.json")"
  echo "    $json_code  latest.json"
  # Installed desktop apps poll meowtrix-latest/latest.json (tauri*.conf.json endpoints); its
  # platform URLs point at this release's updater tarball. Only for the newest release, so a
  # re-run against an older tag doesn't roll installed apps back.
  NEWEST="$(gh release list --repo "$REPO" --limit 100 --exclude-drafts --exclude-pre-releases --json tagName -q '.[].tagName' \
    | grep "^$TAG_PREFIX[0-9]" | sort -V | tail -1)"
  if [ "$NEWEST" = "$TAG" ]; then
    say "publishing latest.json to meowtrix-latest"
    "$ROOT/scripts/publish-latest.sh" "$UPDATER_DIR/latest.json" \
      "$STAGE_DIR/$LITE_DMG_NAME=Meowtrix-Lite-arm64.dmg" \
      "$STAGE_DIR/$STANDALONE_DMG_NAME=Meowtrix-Standalone-arm64.dmg"
  else
    echo "    $TAG isn't the newest release ($NEWEST): meowtrix-latest left alone"
  fi
fi

cat <<EOF

Attached both macOS editions and updater artifacts to $TAG:
  - Meowtrix Lite:       $LITE_DMG_NAME (~5 MB client shell)
  - Meowtrix Standalone: $STANDALONE_DMG_NAME (~55 MB zero-dependency bundle)
  URL: https://github.com/$REPO/releases/tag/$TAG
EOF
