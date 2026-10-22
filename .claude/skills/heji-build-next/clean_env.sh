#!/bin/bash
# heji-build-next §4/§5: run a build's app, server or test suite without the owner's live state.
#   .claude/skills/heji-build-next/clean_env.sh [--home] <command> [args...]
# Drops every variable a HEJI app reads (MEOWTRIX_*, FEEDBACKKIT_*, …): an agent running inside one
# of these apps (e.g. a Meowtrix terminal) inherits them, and a test server would then read and
# write the owner's real data folder. --home also gives the command a fresh empty HOME (for
# servers and apps that keep state under ~; not for xcodebuild/flutter, which need the real one).
# The temp HOME is printed on stderr and left for inspection.
set -euo pipefail
FRESH_HOME=""
if [ "${1:-}" = "--home" ]; then shift; FRESH_HOME=$(mktemp -d "${TMPDIR:-/tmp}/heji-home.XXXXXX"); echo "clean_env: HOME=$FRESH_HOME" >&2; fi
[ $# -gt 0 ] || { echo "usage: clean_env.sh [--home] <command> [args...]" >&2; exit 2; }

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
# One prefix per project (projects/<name> → NAME_), plus the names the apps' code actually reads.
PREFIXES=$(ls "$ROOT/projects" | tr '[:lower:]-' '[:upper:]_' | sed 's/$/_/')
UNSET=()
while IFS='=' read -r name _; do
  for p in $PREFIXES FK_ HEJI_; do
    case "$name" in "$p"*) UNSET+=(-u "$name") ;; esac
  done
done < <(env)
exec env ${UNSET[@]+"${UNSET[@]}"} ${FRESH_HOME:+HOME="$FRESH_HOME"} "$@"
