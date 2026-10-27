#!/usr/bin/env bash
# Copies the shared spec files into the places each build system needs them.
# CI runs this with --check and fails if any copy is stale.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pairs=(
  "spec/event-types.json:apps/ios/LogCore/Sources/LogCore/Resources/event-types.json"
  "spec/calibration.json:apps/ios/LogCore/Sources/LogCore/Resources/calibration.json"
  "spec/fixtures/status.json:apps/ios/LogCore/Tests/LogCoreTests/Fixtures/status.json"
  "spec/event-types.json:apps/android/core/src/main/resources/event-types.json"
  "spec/calibration.json:apps/android/core/src/main/resources/calibration.json"
  "spec/fixtures/status.json:apps/android/core/src/test/resources/fixtures/status.json"
  "spec/event-types.json:packages/core/src/event-types.json"
)
status=0
for p in "${pairs[@]}"; do
  src="$ROOT/${p%%:*}"; dst="$ROOT/${p##*:}"
  if [[ "${1:-}" == "--check" ]]; then
    cmp -s "$src" "$dst" || { echo "stale: ${p##*:} (run scripts/sync-spec.sh)"; status=1; }
  else
    mkdir -p "$(dirname "$dst")"; cp "$src" "$dst"
  fi
done
exit $status
