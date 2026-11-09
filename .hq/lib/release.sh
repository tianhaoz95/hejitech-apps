#!/usr/bin/env bash
# release.sh <project> [args…]: the release verb. A thin wrapper around scripts/cut_release.sh, which
# stays the only release path (root CLAUDE.md). Prints JSON; --dry-run always exits 0 so HQ can show
# what a release would do (or why it would refuse) without changing anything.
set -uo pipefail
source "$(dirname "$0")/json.sh"
ROOT="$(hq_root)"; cd "$ROOT"
PROJECT="$1"; shift
DRY=0; for a in "$@"; do [ "$a" = --dry-run ] && DRY=1; done
out="$(scripts/cut_release.sh "$PROJECT" "$@" 2>&1)"; code=$?
echo "$out" >&2
printf '{"ok":%s,"dry_run":%s,"exit":%d,"output":%s}\n' "$([ $code -eq 0 ] && echo true || echo false)" "$([ $DRY -eq 1 ] && echo true || echo false)" "$code" "$(json_str "$out")"
[ $DRY -eq 1 ] && exit 0 || exit $code
