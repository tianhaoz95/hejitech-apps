#!/usr/bin/env bash
# Uploads files to the rolling `tradeboard-latest` prerelease: stable URLs for the newest Tradeboard
# executor, because the repo's releases/latest belongs to Waypack.
#
#   scripts/publish_latest.sh <file>[=<asset name>] ...
#
# Readers: the Mac app's updater (latest.json), download links (Tradeboard-Executor-arm64.dmg) and
# `install.sh latest` (tradeboard-executor.mjs, install.sh). tradeboard-mac-release.yml and
# tradeboard-executor-release.yml upload here when their release is the newest tradeboard-v.
set -euo pipefail
REPO="${GITHUB_REPOSITORY:-tianhaoz95/hejitech-apps}"
TAG="tradeboard-latest"
[ $# -gt 0 ] || { sed -n '2,10p' "$0"; exit 2; }

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release create "$TAG" --repo "$REPO" --prerelease --latest=false --title "Tradeboard executor (newest)" \
    --notes "Rolling release: always the newest Tradeboard executor and Mac app, at stable URLs for installers and updaters. Versioned releases are tagged tradeboard-v<version>." >/dev/null \
    || gh release view "$TAG" --repo "$REPO" >/dev/null # created concurrently by the other workflow
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
for arg in "$@"; do
  src="${arg%%=*}" name="$(basename "$src")"
  [ "$arg" != "$src" ] && name="${arg#*=}"
  [ -f "$src" ] || { echo "!! $src doesn't exist" >&2; exit 1; }
  cp "$src" "$STAGE/$name"
  for i in 1 2 3 4 5; do
    gh release upload "$TAG" --repo "$REPO" --clobber "$STAGE/$name" && break
    [ "$i" -eq 5 ] && { echo "!! couldn't upload $name" >&2; exit 1; }; sleep 5
  done
  echo "    $TAG ← $name"
done
