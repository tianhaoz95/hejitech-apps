#!/usr/bin/env bash
# Upload files to the rolling `meowtrix-latest` release: stable download URLs for the newest
# Meowtrix, because the monorepo's `releases/latest` belongs to another app.
#
#   scripts/publish-latest.sh <file>[=<asset name>] ...
#
# Who reads it: installed servers (server.js: VERSION, meowtrix-<os>-<arch>.tar.gz), install.sh
# (the tarballs), desktop apps (src-tauri/tauri*.conf.json: latest.json) and the website (the
# DMGs under stable names). meowtrix-release.yml uploads the tarballs and then VERSION;
# meowtrix-mac-release.yml (scripts/release-mac.sh) uploads latest.json and the DMGs. The release
# is a prerelease that is never "latest", created on first use; assets are replaced in place.
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-tianhaoz95/hejitech-apps}"
TAG="meowtrix-latest"
[ $# -gt 0 ] || { sed -n '2,11p' "$0"; exit 2; }

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  # The tag is created at the default branch's head; its commit doesn't matter, only the assets.
  gh release create "$TAG" --repo "$REPO" --prerelease --latest=false --title "Meowtrix (newest build)" \
    --notes "Rolling release: always the newest Meowtrix build, at stable URLs for installers and updaters. Versioned releases are tagged meowtrix-v<version>." >/dev/null \
    || gh release view "$TAG" --repo "$REPO" >/dev/null # created concurrently by the other workflow
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
FILES=()
for arg in "$@"; do
  src="${arg%%=*}" name="$(basename "$src")"
  [ "$arg" != "$src" ] && name="${arg#*=}"
  [ -f "$src" ] || { echo "!! $src doesn't exist" >&2; exit 1; }
  cp "$src" "$STAGE/$name"
  FILES+=("$STAGE/$name")
done

for f in "${FILES[@]}"; do
  for attempt in 1 2 3 4 5; do
    gh release upload "$TAG" --repo "$REPO" --clobber "$f" && break
    [ "$attempt" -eq 5 ] && { echo "!! failed to upload $(basename "$f")" >&2; exit 1; }
    echo "    upload failed (attempt $attempt/5), retrying in 5s..."; sleep 5
  done
  echo "    $TAG ← $(basename "$f")"
done
