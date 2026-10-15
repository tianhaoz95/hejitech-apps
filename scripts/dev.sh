#!/usr/bin/env bash
# Local stack: Supabase (Docker), optional llama-server with Laya for the simulator, and the
# Xcode project. Then run the "App" scheme on an iPhone simulator and sign in as
# parent1@example.com / newborn-dev.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
supabase start
scripts/sync-spec.sh
scripts/build-llama-xcframework.sh
(cd ios && xcodegen generate)
if [[ -n "${LAYA_MODEL:-}" ]] && ! curl -s http://127.0.0.1:8089/health | grep -q ok; then
  "${LLAMA_SERVER_BIN:-llama-server}" -m "$LAYA_MODEL" --port 8089 -ub 2048 -b 2048 >/tmp/llama-server.log 2>&1 &
  echo "llama-server with Laya on :8089 (choose 'Laya on Mac' in Settings → Voice)"
fi
echo "Open ios/WeeHours.xcodeproj, run the App scheme. Glasses: scripts/glasses-sim.sh"
