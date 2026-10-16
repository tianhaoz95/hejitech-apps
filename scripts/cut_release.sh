#!/usr/bin/env bash
# Cut a release of one project: bump its version, push, and publish GitHub Release
# <prefix><version> (e.g. waypack-v1.9.0), which starts that project's release workflows.
# Each project describes itself in projects/<name>/release.env:
#   NAME, TAG_PREFIX, LEGACY_TAG_PREFIX (optional), VERSION_FILE (pubspec.yaml, package.json, or an
#   XcodeGen project.yml whose MARKETING_VERSION is the version),
#   CI_WORKFLOW + CI_PATHS, RELEASE_WORKFLOWS, REQUIRED_SECRETS, LATEST (true for one project only)
#   and optionally a bash function release_check <version> that must pass first (e.g. Voxbrief's
#   in-app What's New has to describe the version being released)
# Pushes to main deploy Cloudflare Workers (Workers Builds), so the version-bump push ships them.
#
#   scripts/cut_release.sh waypack                 # next patch (first release: the version file's)
#   scripts/cut_release.sh waypack minor           # or: major | patch | 1.4.0
#   scripts/cut_release.sh waypack 1.4.0 --notes "Offline maps on the phone"
#   scripts/cut_release.sh waypack --dry-run       # show what would happen, change nothing
#   scripts/cut_release.sh waypack --watch         # wait for the release workflows and report
#   scripts/cut_release.sh waypack --force         # skip the CI-is-green check
#
# Build numbers are assigned by CI (each project's release workflow); pubspec's +build is left alone.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="" BUMP="" NOTES="" DRY=0 WATCH=0 FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    major|minor|patch) BUMP="$1" ;;
    [0-9]*.[0-9]*.[0-9]*) BUMP="$1" ;;
    --notes) NOTES="${2:?--notes needs text}"; shift ;;
    --dry-run) DRY=1 ;;
    --watch) WATCH=1 ;;
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    -*) echo "!! unknown argument: $1 (see --help)" >&2; exit 2 ;;
    *) [ -z "$PROJECT" ] || { echo "!! unknown argument: $1 (see --help)" >&2; exit 2; }; PROJECT="$1" ;;
  esac
  shift
done

die() { echo "!! $*" >&2; exit 1; }
run() { if [ "$DRY" -eq 1 ]; then echo "   (dry run) $*"; else "$@"; fi; }

releasable() { for f in projects/*/release.env; do basename "$(dirname "$f")"; done | paste -sd' ' -; }
[ -n "$PROJECT" ] || die "which project? scripts/cut_release.sh <project> … (releasable: $(releasable))"
CONFIG="projects/$PROJECT/release.env"
[ -f "$CONFIG" ] || die "no $CONFIG (releasable: $(releasable))"

NAME="" TAG_PREFIX="" LEGACY_TAG_PREFIX="" VERSION_FILE="" CI_WORKFLOW="" LATEST=false
CI_PATHS=() RELEASE_WORKFLOWS=() REQUIRED_SECRETS=()
# shellcheck source=/dev/null
source "$CONFIG"
for v in NAME TAG_PREFIX VERSION_FILE CI_WORKFLOW; do [ -n "${!v}" ] || die "$CONFIG: $v is not set"; done
[ ${#CI_PATHS[@]} -gt 0 ] || die "$CONFIG: CI_PATHS is empty"
[ -f "$VERSION_FILE" ] || die "$CONFIG: VERSION_FILE $VERSION_FILE does not exist"
if [ "$LATEST" = true ]; then
  others="$(grep -l '^LATEST=true' projects/*/release.env | grep -vx "$CONFIG" || true)"
  [ -z "$others" ] || die "LATEST=true in $CONFIG and $others: only one project may own the repo's latest release"
fi

# ------------------------------------------------------------------ preflight

command -v gh >/dev/null || die "the GitHub CLI (gh) is required"
gh auth status >/dev/null 2>&1 || die "gh is not logged in (gh auth login)"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"

[ "$(git branch --show-current)" = main ] || die "release from main (on $(git branch --show-current))"
[ -z "$(git status --porcelain)" ] || die "working tree has uncommitted changes"
git fetch -q origin main --tags
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main differs from origin/main: pull or push first"
HEAD_SHA="$(git rev-parse HEAD)"

# The release ships whatever CI last checked. CI only runs on commits touching CI_PATHS, so check
# the newest of those; later commits only changed other projects.
CI_SHA="$(git log -1 --format=%H HEAD -- "${CI_PATHS[@]}")"
if [ "$FORCE" -eq 0 ]; then
  CI="$(gh run list --repo "$REPO" --workflow "$CI_WORKFLOW" --commit "$CI_SHA" --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || true)"
  case "$CI" in
    "completed success") echo "==> $CI_WORKFLOW is green on ${CI_SHA:0:7}" ;;
    "") die "no $CI_WORKFLOW run for ${CI_SHA:0:7} yet (push first, or --force)" ;;
    completed*) die "$CI_WORKFLOW failed on ${CI_SHA:0:7} ($CI): fix it, or --force" ;;
    *) die "$CI_WORKFLOW is still running on ${CI_SHA:0:7}: wait for it, or --force" ;;
  esac
fi

# Signing material the release workflows need (names only; values are never readable).
if [ ${#REQUIRED_SECRETS[@]} -gt 0 ]; then
  SECRETS="$(gh secret list --repo "$REPO" --json name -q '.[].name')"
  missing=()
  for s in "${REQUIRED_SECRETS[@]}"; do grep -qx "$s" <<<"$SECRETS" || missing+=("$s"); done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "!! missing repo secrets: ${missing[*]} (see projects/$PROJECT/docs)" >&2
    [ "$FORCE" -eq 1 ] || die "the release workflows would fail; set them, or --force"
  fi
fi

# -------------------------------------------------------------- version

case "$VERSION_FILE" in
  *pubspec.yaml)
    FILE_LINE="$(grep -E '^version:' "$VERSION_FILE" | awk '{print $2}')"
    FILE_VERSION="${FILE_LINE%%+*}" FILE_BUILD="${FILE_LINE#*+}"
    [ "$FILE_BUILD" = "$FILE_LINE" ] && FILE_BUILD="" ;;
  *package.json)
    FILE_LINE="$(node -p "require('./$VERSION_FILE').version")" FILE_VERSION="$FILE_LINE" FILE_BUILD="" ;;
  *project.yml)
    FILE_LINE="$(sed -nE 's/^[[:space:]]*MARKETING_VERSION:[[:space:]]*"?([0-9]+\.[0-9]+\.[0-9]+)"?.*/\1/p' "$VERSION_FILE" | head -1)"
    [ -n "$FILE_LINE" ] || die "$VERSION_FILE has no MARKETING_VERSION: x.y.z"
    FILE_VERSION="$FILE_LINE" FILE_BUILD="" ;;
  *) die "$CONFIG: VERSION_FILE must be a pubspec.yaml, package.json or project.yml" ;;
esac
set_version() { # $1 = new x.y.z
  case "$VERSION_FILE" in
    *pubspec.yaml)
      sed -i.bak -E "s/^version: .*/version: $1${FILE_BUILD:++$FILE_BUILD}/" "$VERSION_FILE" && rm -f "$VERSION_FILE.bak" ;;
    *package.json)
      node -e 'const f=process.argv[1],p=require("./"+f);p.version=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")' "$VERSION_FILE" "$1" ;;
    *project.yml)
      sed -i.bak -E "s/^([[:space:]]*MARKETING_VERSION:[[:space:]]*)\"?[0-9]+\.[0-9]+\.[0-9]+\"?/\1\"$1\"/" "$VERSION_FILE" && rm -f "$VERSION_FILE.bak" ;;
  esac
}

last_tag() { git tag -l "$1[0-9]*.[0-9]*.[0-9]*" --sort=-v:refname | head -1; }
LAST_TAG="$(last_tag "$TAG_PREFIX")" LAST_PREFIX="$TAG_PREFIX"
if [ -z "$LAST_TAG" ] && [ -n "$LEGACY_TAG_PREFIX" ]; then
  LAST_TAG="$(last_tag "$LEGACY_TAG_PREFIX")" LAST_PREFIX="$LEGACY_TAG_PREFIX"
fi
BASE="${LAST_TAG#"$LAST_PREFIX"}"

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  NEXT="$BUMP"
elif [ -z "$LAST_TAG" ] && [ -z "$BUMP" ]; then
  NEXT="$FILE_VERSION" # first release: ship what the version file already says
else
  [ -n "$BASE" ] || BASE="$FILE_VERSION"
  IFS=. read -r MA MI PA <<<"$BASE"
  case "${BUMP:-patch}" in
    major) NEXT="$((MA + 1)).0.0" ;;
    minor) NEXT="$MA.$((MI + 1)).0" ;;
    patch) NEXT="$MA.$MI.$((PA + 1))" ;;
  esac
fi
TAG="$TAG_PREFIX$NEXT"
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null && die "tag $TAG already exists"
gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1 && die "release $TAG already exists"
newer() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" = "$1" ]; }
if [ -n "$LAST_TAG" ] && ! newer "$NEXT" "$BASE"; then
  die "$NEXT is not newer than the last release $LAST_TAG"
fi
# Never go below what the version file (and so TestFlight) already has.
if [ "$NEXT" != "$FILE_VERSION" ] && ! newer "$NEXT" "$FILE_VERSION"; then
  die "$NEXT is older than $VERSION_FILE's $FILE_VERSION"
fi

if declare -F release_check >/dev/null; then
  release_check "$NEXT" || die "$CONFIG: release_check $NEXT failed"
fi

echo "==> releasing $NAME $TAG (last: ${LAST_TAG:-none}; $VERSION_FILE $FILE_LINE)"

# --------------------------------------------------------------- release

if [ "$FILE_VERSION" != "$NEXT" ]; then
  echo "==> $VERSION_FILE: $FILE_LINE → $NEXT${FILE_BUILD:++$FILE_BUILD}"
  if [ "$DRY" -eq 0 ]; then
    set_version "$NEXT"
    git add "$VERSION_FILE"
    git commit -q -m "Release $NAME $NEXT"
    git push -q origin main
  else
    echo "   (dry run) commit \"Release $NAME $NEXT\" and push (deploys Cloudflare Workers)"
  fi
  HEAD_SHA="$(git rev-parse HEAD)"
fi

ARGS=(--repo "$REPO" --target "$HEAD_SHA" --title "$NAME $NEXT")
if [ "$LATEST" = true ]; then ARGS+=(--latest); else ARGS+=(--latest=false); fi
# Generated notes start at this project's previous tag, not whichever project released last.
if [ -n "$NOTES" ]; then ARGS+=(--notes "$NOTES"); else ARGS+=(--generate-notes ${LAST_TAG:+--notes-start-tag "$LAST_TAG"}); fi
echo "==> publishing GitHub Release $TAG at ${HEAD_SHA:0:7}"
run gh release create "$TAG" "${ARGS[@]}"

[ "$DRY" -eq 1 ] && { echo "==> dry run: nothing was changed"; exit 0; }

echo "==> started:"
if [ ${#RELEASE_WORKFLOWS[@]} -gt 0 ]; then
  for wf in "${RELEASE_WORKFLOWS[@]}"; do echo "    https://github.com/$REPO/actions/workflows/$wf"; done
fi
echo "    release: https://github.com/$REPO/releases/tag/$TAG"

if [ "$WATCH" -eq 1 ] && [ ${#RELEASE_WORKFLOWS[@]} -gt 0 ]; then
  sleep 10 # let the release event fan out
  status=0
  for wf in "${RELEASE_WORKFLOWS[@]}"; do
    id="$(gh run list --repo "$REPO" --workflow "$wf" --event release --limit 1 --json databaseId -q '.[0].databaseId')"
    [ -n "$id" ] || { echo "!! no $wf run found" >&2; status=1; continue; }
    echo "==> waiting for $wf ($id)…"
    if gh run watch "$id" --repo "$REPO" --exit-status --interval 30 >/dev/null; then
      echo "    $wf: success"
    else
      echo "!! $wf failed: gh run view $id --repo $REPO --log-failed" >&2
      status=1
    fi
  done
  exit "$status"
fi
