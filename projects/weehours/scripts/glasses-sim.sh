#!/usr/bin/env bash
# One command to try the glasses app in the official Even Hub simulator against the local backend.
#   scripts/glasses-sim.sh            interactive: simulator window, signed in as parent1
#   scripts/glasses-sim.sh --e2e      scripted run through the simulator automation API
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=5173
AUTOMATION_PORT=9898

if ! curl -s -o /dev/null http://127.0.0.1:54321/rest/v1/; then
  echo "Starting local Supabase (Docker must be running)…"
  (cd "$ROOT" && supabase start >/dev/null)
fi

cd "$ROOT/glasses"
[ -d node_modules ] || npm install --no-audit --no-fund
if ! curl -s -o /dev/null "http://127.0.0.1:${PORT}"; then
  npm run dev >/tmp/weehours-glasses-vite.log 2>&1 &
  VITE_PID=$!
  trap 'kill $VITE_PID 2>/dev/null || true; [ -n "${SIM_PID:-}" ] && kill $SIM_PID 2>/dev/null || true' EXIT
  for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:${PORT}" && break; sleep 0.25; done
fi

URL="http://127.0.0.1:${PORT}/?email=parent1@example.com&password=newborn-dev"
if [[ "${1:-}" == "--e2e" ]]; then
  npx evenhub-simulator "${URL}&fakeaudio=1" --automation-port ${AUTOMATION_PORT} --no-glow >/tmp/weehours-glasses-sim.log 2>&1 &
  SIM_PID=$!
  node "$ROOT/scripts/glasses-e2e.mjs" "http://127.0.0.1:${AUTOMATION_PORT}"
else
  echo "Simulator: press = feed start/finish · double press = diaper · swipe = menu · hold = speak"
  npx evenhub-simulator "$URL" --glow
fi
