#!/usr/bin/env bash
# Runs the glasses plugin in the official Even Hub simulator against the local backend (shared
# Supabase stack + dev:worker on 127.0.0.1:8794), paired to the seed athlete with a fresh code.
#   projects/fitloop/scripts/glasses-sim.sh          interactive
#   projects/fitloop/scripts/glasses-sim.sh --e2e    scripted run (scripts/glasses-e2e.mjs)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=5178 AUTOMATION_PORT=9900
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
curl -s -o /dev/null http://127.0.0.1:8794/ || { echo "start the Worker first: npm run dev:worker -w @fitloop/web"; exit 1; }
PIDS=()
trap 'for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done' EXIT
cd "$ROOT/apps/glasses"
if ! curl -s -o /dev/null "http://127.0.0.1:${PORT}"; then
  npx vite --host 127.0.0.1 --port $PORT >/tmp/fitloop-glasses-vite.log 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:${PORT}" && break; sleep 0.25; done
fi
JWT=$(curl -s "http://127.0.0.1:55421/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"athlete@example.com","password":"fitloop-dev"}' | jq -r .access_token)
CODE=$(curl -s -X POST http://127.0.0.1:8794/api/pairing-code -H "Authorization: Bearer $JWT" | jq -r .code)
[[ "$CODE" =~ ^[0-9]{6}$ ]] || { echo "couldn't get a pairing code"; exit 1; }
URL="http://127.0.0.1:${PORT}/?api=http://127.0.0.1:8794&pair=${CODE}&date=${DATE:-2026-10-26}${DEBUG_CONSOLE:+&debug=1}"
if [[ "${1:-}" == "--e2e" ]]; then
  npx evenhub-simulator "$URL" --automation-port ${AUTOMATION_PORT} --no-glow >/tmp/fitloop-glasses-sim.log 2>&1 &
  PIDS+=($!)
  node "$ROOT/scripts/glasses-e2e.mjs" "http://127.0.0.1:${AUTOMATION_PORT}"
else
  echo "Simulator: swipe = move · click = open, set done · hold = how-to · double click = menu"
  npx evenhub-simulator "$URL" --glow
fi
