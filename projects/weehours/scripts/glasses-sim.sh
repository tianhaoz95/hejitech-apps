#!/usr/bin/env bash
# One command to try the glasses app in the official Even Hub simulator against the local backend:
# local Supabase, the site Worker (the glasses' API) and Vite, paired to parent1's household with a
# code fetched the way the iPhone app does.
#   scripts/glasses-sim.sh            interactive: simulator window, paired as parent1
#   scripts/glasses-sim.sh --e2e      scripted run through the simulator automation API
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT=5173
AUTOMATION_PORT=9898

if ! curl -s -o /dev/null http://127.0.0.1:55421/rest/v1/; then
  echo "Starting local Supabase (Docker must be running)…"
  (cd "$ROOT/../.." && supabase start >/dev/null)
fi

ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
PIDS=()
trap 'for p in "${PIDS[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null || true; done' EXIT

if ! curl -s -o /dev/null http://127.0.0.1:8788/; then
  echo "Starting the site Worker (dev:worker)…"
  (cd "$ROOT/services/web" && [ -f .dev.vars ] || echo "SUPABASE_SERVICE_ROLE_KEY=$(cd "$ROOT/../.." && supabase status -o json | jq -r .SERVICE_ROLE_KEY)" > "$ROOT/services/web/.dev.vars")
  (cd "$ROOT/services/web" && npm run dev:worker >/tmp/weehours-worker.log 2>&1) &
  PIDS+=($!)
  for _ in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:8788/ && break; sleep 1; done
fi

cd "$ROOT/apps/glasses"
[ -d node_modules ] || npm install --no-audit --no-fund
if ! curl -s -o /dev/null "http://127.0.0.1:${PORT}"; then
  npm run dev >/tmp/weehours-glasses-vite.log 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:${PORT}" && break; sleep 0.25; done
fi

# A pairing code for parent1, as Settings → Even G2 glasses gets one.
JWT=$(curl -s "http://127.0.0.1:55421/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"parent1@example.com","password":"newborn-dev"}' | jq -r .access_token)
CODE=$(curl -s -X POST http://127.0.0.1:8788/api/glasses/pairing-code -H "Authorization: Bearer $JWT" | jq -r .code)
[[ "$CODE" =~ ^[0-9]{6}$ ]] || { echo "couldn't get a pairing code (is the Worker up? /tmp/weehours-worker.log)"; exit 1; }

URL="http://127.0.0.1:${PORT}/?api=http://127.0.0.1:8788&pair=${CODE}"
if [[ "${1:-}" == "--e2e" ]]; then
  npx evenhub-simulator "${URL}&fakeaudio=1" --automation-port ${AUTOMATION_PORT} --no-glow >/tmp/weehours-glasses-sim.log 2>&1 &
  PIDS+=($!)
  node "$ROOT/scripts/glasses-e2e.mjs" "http://127.0.0.1:${AUTOMATION_PORT}"
else
  echo "Simulator: press = feed start/finish · double press = diaper · swipe = menu · hold = speak"
  npx evenhub-simulator "$URL" --glow
fi
