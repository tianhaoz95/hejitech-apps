#!/usr/bin/env bash
# Builds the Tradeboard Executor Mac app (apps/desktop), signs it with the team's Developer ID,
# notarizes and staples it, builds the DMG and the Tauri updater tarball from the stapled app, and
# attaches them to the tradeboard-v<version> release; refreshes tradeboard-latest (latest.json for
# installed apps, a stable DMG name for download links) when that release is the newest.
#
#   scripts/release_mac.sh --tag tradeboard-v0.2.0   # what tradeboard-mac-release.yml runs
#   scripts/release_mac.sh --no-upload               # build, sign, notarize only
#   scripts/release_mac.sh --skip-build --no-upload  # re-sign the app already built
#
# The release itself comes from the repo's scripts/cut_release.sh tradeboard.
# Identity: FA_MAC_IDENTITY, else the first "Developer ID Application" in the keychain.
# Notarization: FA_KEY_LOCATION (.p8) or FA_ASC_KEY_ID (in ~/.appstoreconnect/private_keys) + FA_ASC_ISSUER_ID.
# Updater key: TAURI_SIGNING_PRIVATE_KEY, else ~/Credentials/tradeboard-updater.key.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
REPO="${GITHUB_REPOSITORY:-tianhaoz95/hejitech-apps}"
APP_NAME="Tradeboard Executor"
FILE_NAME="Tradeboard-Executor"
DESKTOP="$ROOT/apps/desktop"
APP="$DESKTOP/src-tauri/target/release/bundle/macos/$APP_NAME.app"
OUT="$ROOT/build/release-mac"

TAG=""; SKIP_BUILD=0; NO_UPLOAD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:-}"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    --no-upload) NO_UPLOAD=1; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "!! unknown argument: $1" >&2; exit 2 ;;
  esac
done
say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die() { echo "!! $*" >&2; exit 1; }

VERSION="$(node -p "require('$ROOT/apps/executor/package.json').version")"
[ -z "$TAG" ] || [ "$TAG" = "tradeboard-v$VERSION" ] || die "apps/executor/package.json says $VERSION but the tag is $TAG"

# ------------------------------------------------------------------ preflight
IDENTITY="${FA_MAC_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | grep "Developer ID Application" | head -1 | sed 's/.*"\(.*\)".*/\1/')}"
[ -n "$IDENTITY" ] || die "no \"Developer ID Application\" identity in the keychain (the team's, imported; never create one)"
if [ -n "${FA_KEY_LOCATION:-}" ]; then
  ASC_KEY="${FA_KEY_LOCATION/#\~/$HOME}"
  ASC_KEY_ID="${FA_ASC_KEY_ID:-$(basename "$ASC_KEY" .p8 | sed 's/^AuthKey_//')}"
else
  ASC_KEY_ID="${FA_ASC_KEY_ID:-}"
  ASC_KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID:-none}.p8"
fi
[ -n "$ASC_KEY_ID" ] && [ -n "${FA_ASC_ISSUER_ID:-}" ] && [ -f "$ASC_KEY" ] || die "notarization needs FA_ASC_KEY_ID (or FA_KEY_LOCATION) and FA_ASC_ISSUER_ID"
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
  [ -f "$HOME/Credentials/tradeboard-updater.key" ] || die "no updater key: TAURI_SIGNING_PRIVATE_KEY or ~/Credentials/tradeboard-updater.key"
  export TAURI_SIGNING_PRIVATE_KEY="$(cat "$HOME/Credentials/tradeboard-updater.key")"
fi
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
echo "    version   $VERSION"
echo "    identity  $IDENTITY"
echo "    notary    API key $ASC_KEY_ID"

# ---------------------------------------------------------------------- build
if [ "$SKIP_BUILD" -eq 0 ]; then
  say "building $APP_NAME $VERSION"
  (cd "$DESKTOP" && npm run tauri -- build -b app --no-sign)
fi
[ -d "$APP" ] || die "no app at $APP (drop --skip-build)"
grep -q "tradeboard-executor $VERSION " "$APP/Contents/Resources/tradeboard-executor.mjs" \
  || die "the app's bundled executor isn't $VERSION"

# ----------------------------------------------------------------------- sign
say "signing"
find "$APP/Contents" -type f -perm +111 ! -path "*/MacOS/*" -print0 | xargs -0 -r codesign --force --sign "$IDENTITY" --timestamp --options runtime 2>/dev/null || true
codesign --force --sign "$IDENTITY" --timestamp --options runtime --entitlements "$DESKTOP/src-tauri/Entitlements.plist" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
if codesign -d --entitlements - --xml "$APP" 2>/dev/null | grep -q get-task-allow; then die "get-task-allow is set (debug entitlements)"; fi

# ------------------------------------------------------------------------ dmg
say "building the DMG"
mkdir -p "$OUT"
DMG="$OUT/$FILE_NAME-$VERSION-arm64.dmg"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir "$STAGE/dmg"
cp -R "$APP" "$STAGE/dmg/"
ln -s /Applications "$STAGE/dmg/Applications"
rm -f "$DMG"
for i in 1 2 3 4 5; do
  hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE/dmg" -ov -format UDZO "$DMG" >/dev/null && break
  [ "$i" -eq 5 ] && die "hdiutil create failed"; sleep 2
done
codesign --force --sign "$IDENTITY" --timestamp "$DMG"

# ------------------------------------------------------------------- notarize
say "notarizing (a few minutes)"
xcrun notarytool submit "$DMG" --key "$ASC_KEY" --key-id "$ASC_KEY_ID" --issuer "$FA_ASC_ISSUER_ID" --wait
staple() { local d=15; for i in 1 2 3 4 5 6; do xcrun stapler staple "$1" && return 0; [ "$i" -eq 6 ] && return 1; sleep "$d"; d=$((d * 2)); done; }
staple "$DMG"
staple "$APP"
spctl -a -vvv -t exec "$APP"

# ---------------------------------------------------- updater, from the stapled app
say "updater tarball"
UPD="$OUT/updater"
rm -rf "$UPD" && mkdir -p "$UPD"
TARBALL="$UPD/$FILE_NAME.app.tar.gz"
# No AppleDouble (._*) entries: the Tauri updater aborts on them.
COPYFILE_DISABLE=1 tar --no-mac-metadata -czf "$TARBALL" -C "$(dirname "$APP")" "$(basename "$APP")"
if tar -tzf "$TARBALL" | grep -q '/\._'; then die "AppleDouble entries in the updater tarball"; fi
(cd "$DESKTOP" && npx tauri signer sign "$TARBALL" >/dev/null)
[ -f "$TARBALL.sig" ] || die "no updater signature"
node -e '
const [v, sig, url, out] = process.argv.slice(1);
require("fs").writeFileSync(out, JSON.stringify({ version: v, notes: `Tradeboard Executor ${v}`, pub_date: new Date().toISOString(),
  platforms: { "darwin-aarch64": { signature: require("fs").readFileSync(sig, "utf8").trim(), url } } }, null, 2) + "\n");
' "$VERSION" "$TARBALL.sig" "https://github.com/$REPO/releases/download/tradeboard-v$VERSION/$FILE_NAME.app.tar.gz" "$UPD/latest.json"

if [ "$NO_UPLOAD" -eq 1 ]; then
  say "done (not uploaded)"; echo "    $DMG"; echo "    $UPD"; exit 0
fi

# -------------------------------------------------------------------- publish
TAG="${TAG:-tradeboard-v$VERSION}"
gh release view "$TAG" --repo "$REPO" >/dev/null || die "release $TAG doesn't exist: scripts/cut_release.sh tradeboard first"
say "attaching to $TAG"
for f in "$DMG" "$TARBALL" "$TARBALL.sig" "$UPD/latest.json"; do
  for i in 1 2 3 4 5; do
    gh release upload "$TAG" --repo "$REPO" --clobber "$f" && break
    [ "$i" -eq 5 ] && die "couldn't upload $(basename "$f")"; sleep 5
  done
done
NEWEST="$(gh release list --repo "$REPO" --limit 100 --exclude-drafts --exclude-pre-releases --json tagName -q '.[].tagName' | grep '^tradeboard-v[0-9]' | sort -V | tail -1)"
if [ "$NEWEST" = "$TAG" ]; then
  say "refreshing tradeboard-latest"
  "$ROOT/scripts/publish_latest.sh" "$UPD/latest.json" "$DMG=$FILE_NAME-arm64.dmg"
else
  echo "    $TAG isn't the newest ($NEWEST): tradeboard-latest left alone"
fi
echo "Done: https://github.com/$REPO/releases/tag/$TAG"
