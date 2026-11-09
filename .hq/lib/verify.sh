#!/usr/bin/env bash
# verify.sh <project>: runs the checks the project's CLAUDE.md names for CI (npm typecheck + tests).
set -uo pipefail
source "$(dirname "$0")/json.sh"
ROOT="$(hq_root)"; cd "$ROOT"
P="$1"; log=""; ok=true
for s in "typecheck:$P" "test:$P"; do
  if node -e "process.exit(require('./package.json').scripts['$s'] ? 0 : 1)"; then
    o="$(npm run -s "$s" 2>&1)"; c=$?; log+="\$ npm run $s (exit $c)"$'\n'"$(echo "$o" | tail -40)"$'\n'
    [ $c -eq 0 ] || ok=false
  fi
done
echo "$log" >&2
printf '{"ok":%s,"log":%s}\n' "$ok" "$(json_str "$log")"
$ok
