#!/usr/bin/env bash
# Build, sign, notarize, and attach macOS desktop edition to an existing GitHub release.
#
#   ./scripts/release-mac.sh                  # attach to the newest polymath-v release
#   ./scripts/release-mac.sh --tag polymath-v0.1.0   # a specific tag
#   ./scripts/release-mac.sh --skip-build     # reuse the bundle already built
#   ./scripts/release-mac.sh --no-upload      # build, sign, notarize only — don't attach
#   ./scripts/release-mac.sh --check          # verify credentials resolve, build nothing
#
# The release itself is created by the monorepo's scripts/cut_release.sh polymath -- this script
# only attaches the signed, notarized DMG and updater artifacts to a release that already
# exists, and refreshes the rolling polymath-latest release (scripts/publish-latest.sh) that
# installed desktop apps poll for latest.json.
# .github/workflows/polymath-mac-release.yml runs this same script in CI on `release: published`.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
REPO="${GITHUB_REPOSITORY:-tianhaoz95/hejitech-apps}"
TAG_PREFIX="polymath-v"
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
    TAG="$(gh release list --repo "$REPO" --limit 100 --exclude-drafts --exclude-pre-releases --json tagName -q '.[].tagName' 2>/dev/null \
      | grep "^$TAG_PREFIX[0-9]" | sort -V | tail -1 || true)"
    [ -n "$TAG" ] || die "no tag given and no polymath-v release found — pass --tag, or run scripts/cut_release.sh polymath first."
  fi
  echo "    release tag     $TAG"
fi

if [ "$CHECK_ONLY" -eq 1 ]; then
  say "setup looks good — run without --check to build and release"
  exit 0
fi

APP="$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/Polymath.app"

# --------------------------------------------------------------------- build
if [ "$SKIP_BUILD" -eq 0 ]; then
  say "running polymath tests"
  (cd "$ROOT/../../" && npm run test:polymath)

  say "building Polymath Desktop"
  (cd "$ROOT/apps/desktop" && npm run tauri build -- -b app --no-sign)
else
  say "skipping build"
fi

[ -d "$APP" ] || die "no app bundle at $APP — drop --skip-build"

# ------------------------------------------------------- sign + notarize
mkdir -p "$BUILD_DIR/dmg"
DMG="$BUILD_DIR/dmg/Polymath-signed.dmg"

say "signing and notarizing Polymath"
"$ROOT/scripts/sign-desktop.sh" \
  --app "$APP" \
  --dmg "$DMG" \
  --volume "Polymath" \
  --notarize

[ -f "$DMG" ] || die "expected artifact missing: $DMG"

if [ "$NO_UPLOAD" -eq 1 ]; then
  say "done (not uploaded)"
  echo "  $DMG"
  exit 0
fi

# --------------------------------------------------------------- publish
VERSION="$(python3 -c "import json; print(json.load(open('$ROOT/apps/desktop/package.json'))['version'])")"
DMG_NAME="Polymath-$VERSION-arm64.dmg"

say "attaching Polymath to $TAG"
[ -n "$TOKEN" ] && export GH_TOKEN="$TOKEN"

gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 \
  || die "release $TAG does not exist yet — run scripts/cut_release.sh polymath first"

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT
cp "$DMG" "$STAGE_DIR/$DMG_NAME"

UPLOAD_FILES=(
  "$STAGE_DIR/$DMG_NAME#$DMG_NAME"
)

UPDATER_DIR="$ROOT/apps/desktop/src-tauri/target/release/bundle/macos/updater"
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
code="$(curl -s -o /dev/null -w '%{http_code}' -L "https://github.com/$REPO/releases/download/$TAG/$DMG_NAME")"
[ "$code" = "200" ] || die "$DMG_NAME is not fetchable (got $code)"
echo "    $code  $DMG_NAME"

if [ -f "$UPDATER_DIR/latest.json" ]; then
  json_code="$(curl -s -o /dev/null -w '%{http_code}' -L "https://github.com/$REPO/releases/download/$TAG/latest.json")"
  echo "    $json_code  latest.json"
  NEWEST="$(gh release list --repo "$REPO" --limit 100 --exclude-drafts --exclude-pre-releases --json tagName -q '.[].tagName' \
    | grep "^$TAG_PREFIX[0-9]" | sort -V | tail -1)"
  if [ "$NEWEST" = "$TAG" ]; then
    say "publishing latest.json to polymath-latest"
    "$ROOT/scripts/publish-latest.sh" "$UPDATER_DIR/latest.json" \
      "$STAGE_DIR/$DMG_NAME=Polymath-arm64.dmg"
  else
    echo "    $TAG isn't the newest release ($NEWEST): polymath-latest left alone"
  fi
fi

cat <<EOF

Attached Polymath desktop and updater artifacts to $TAG:
  - Polymath: $DMG_NAME
  URL: https://github.com/$REPO/releases/tag/$TAG
EOF
