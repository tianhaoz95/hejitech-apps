#!/usr/bin/env bash
# project-health.sh <project-dir>: a project's health as JSON, from what its release.env already
# declares (CI_WORKFLOW, TAG_PREFIX). Read-only: git and `gh run list`.
set -euo pipefail
source "$(dirname "$0")/json.sh"
ROOT="$(hq_root)"; DIR="$1"; cd "$ROOT"
CI_WORKFLOW="" TAG_PREFIX="" NAME="$(basename "$DIR")"
[ -f "$DIR/release.env" ] && source "$DIR/release.env"

ci="unknown" ci_url="" ci_at=""
if [ -n "$CI_WORKFLOW" ] && command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  line="$(gh run list --workflow "$CI_WORKFLOW" --branch main --limit 1 --json conclusion,status,url,createdAt -q '.[0] | "\(.status) \(.conclusion) \(.url) \(.createdAt)"' 2>/dev/null || true)"
  if [ -n "$line" ]; then
    read -r st concl ci_url ci_at <<<"$line"
    if [ "$st" = completed ]; then ci="$concl"; else ci="$st"; fi
  fi
fi
tag="" tag_at=""
if [ -n "$TAG_PREFIX" ]; then
  tag="$(git tag -l "${TAG_PREFIX}*" --sort=-creatordate | head -1)"
  [ -n "$tag" ] && tag_at="$(git log -1 --format=%cI "$tag" 2>/dev/null || true)"
fi
last_commit="$(git log -1 --format=%cI -- "$DIR" 2>/dev/null || true)"
commits_30d="$(git rev-list --count --since=30.days HEAD -- "$DIR" 2>/dev/null || echo 0)"
ok=true; [ "$ci" = failure ] && ok=false
printf '{"ok":%s,"ci":"%s","ci_url":"%s","ci_at":"%s","latest_release":"%s","released_at":"%s","last_commit":"%s","commits_30d":%s}\n' \
  "$ok" "$ci" "$ci_url" "$ci_at" "$tag" "$tag_at" "$last_commit" "$commits_30d"
