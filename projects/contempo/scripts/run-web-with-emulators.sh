#!/usr/bin/env bash
# Starts the Firebase emulator suite and the web app's Vite dev server
# together (both talk over "localhost", no adb-reverse-style wiring needed
# the way android/ requires for a physical device). Ctrl+C (or any exit)
# tears both down together.
#
# Usage: ./scripts/run-web-with-emulators.sh [firebase-project-id]
#   The Firestore/Auth emulators partition data BY PROJECT ID — a client
#   configured for project A gets a completely separate, empty namespace
#   from project B, even against the same running emulator process. So this
#   defaults to whatever project web/.env.local's VITE_FIREBASE_PROJECT_ID is
#   already set to (falling back to "demo-contempo" if that file is missing),
#   NOT an independent placeholder — passing a different id here means the
#   web app's emulator-mode Firestore reads will come back empty.
set -euo pipefail
set -m # give the emulator suite its own process group so it can be killed as a unit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$ROOT_DIR/web"
BACKEND_DIR="$ROOT_DIR/backend"

DEFAULT_PROJECT_ID="demo-contempo"
if [[ -f "$WEB_DIR/.env.local" ]]; then
  ENV_PROJECT_ID="$(sed -n 's/^VITE_FIREBASE_PROJECT_ID=//p' "$WEB_DIR/.env.local")"
  [[ -n "$ENV_PROJECT_ID" ]] && DEFAULT_PROJECT_ID="$ENV_PROJECT_ID"
fi
PROJECT_ID="${1:-$DEFAULT_PROJECT_ID}"

EMULATOR_LOG="$(mktemp -t contempo-emulators.XXXXXX.log)"
VITE_LOG="$(mktemp -t contempo-vite.XXXXXX.log)"
EMULATOR_READY_TIMEOUT=90
VITE_READY_TIMEOUT=30

FIREBASE_PID=""
VITE_PID=""
TAIL_PID=""

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  log "Shutting down..."

  if [[ -n "$TAIL_PID" ]] && kill -0 "$TAIL_PID" 2>/dev/null; then
    kill "$TAIL_PID" 2>/dev/null || true
  fi

  if [[ -n "$VITE_PID" ]] && kill -0 "$VITE_PID" 2>/dev/null; then
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
    echo "  vite dev server stopped"
  fi

  if [[ -n "$FIREBASE_PID" ]] && kill -0 "$FIREBASE_PID" 2>/dev/null; then
    echo "  stopping Firebase emulators (pid $FIREBASE_PID)..."
    kill -INT -- "-$FIREBASE_PID" 2>/dev/null || kill -INT "$FIREBASE_PID" 2>/dev/null || true
    for _ in $(seq 1 15); do
      kill -0 "$FIREBASE_PID" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$FIREBASE_PID" 2>/dev/null; then
      warn "emulators still alive after 15s, forcing..."
      kill -KILL -- "-$FIREBASE_PID" 2>/dev/null || kill -KILL "$FIREBASE_PID" 2>/dev/null || true
    fi
    echo "  Firebase emulators stopped"
  fi

  rm -f "$EMULATOR_LOG" "$VITE_LOG"
  log "All services stopped."
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

if ! command -v firebase >/dev/null 2>&1; then
  warn "Could not find the firebase CLI on PATH (npm install -g firebase-tools)."
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  warn "Could not find npm on PATH."
  exit 1
fi

# --- sanity-check web/.env.local --------------------------------------------
if [[ ! -f "$WEB_DIR/.env.local" ]]; then
  warn "web/.env.local is missing. Copy web/.env.example to web/.env.local and fill" \
       "it in (see web/README.md), or run:" \
       "  npx -y firebase-tools@latest apps:sdkconfig WEB <APP_ID> --project contempo-str"
  exit 1
fi
CONFIGURED_PROJECT_ID="$(sed -n 's/^VITE_FIREBASE_PROJECT_ID=//p' "$WEB_DIR/.env.local")"
if [[ -n "$CONFIGURED_PROJECT_ID" && "$CONFIGURED_PROJECT_ID" != "$PROJECT_ID" ]]; then
  warn "web/.env.local's VITE_FIREBASE_PROJECT_ID ($CONFIGURED_PROJECT_ID) differs from" \
       "the emulator project this script is starting ($PROJECT_ID). The Firestore/Auth" \
       "emulators partition data by project id, so the web app will see an EMPTY" \
       "namespace, not $PROJECT_ID's data — pass \"$CONFIGURED_PROJECT_ID\" explicitly," \
       "or omit the argument to pick it up automatically."
fi

if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  log "Installing web/ dependencies (npm install)..."
  ( cd "$WEB_DIR" && npm install )
fi

# --- start the Firebase emulator suite --------------------------------------
log "Starting Firebase emulators (project: $PROJECT_ID)..."
( cd "$BACKEND_DIR" && exec firebase emulators:start --project "$PROJECT_ID" ) >"$EMULATOR_LOG" 2>&1 &
FIREBASE_PID=$!
echo "  pid $FIREBASE_PID, logging to $EMULATOR_LOG"

echo "  waiting for emulators to come up (up to ${EMULATOR_READY_TIMEOUT}s)..."
ready=false
for _ in $(seq 1 "$EMULATOR_READY_TIMEOUT"); do
  if ! kill -0 "$FIREBASE_PID" 2>/dev/null; then
    warn "Firebase emulator process exited early. Last log lines:"
    tail -n 40 "$EMULATOR_LOG" >&2
    exit 1
  fi
  if grep -q "All emulators ready" "$EMULATOR_LOG" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  warn "Emulators did not report ready within ${EMULATOR_READY_TIMEOUT}s. Last log lines:"
  tail -n 40 "$EMULATOR_LOG" >&2
  exit 1
fi
echo "  emulators ready — Emulator UI: http://localhost:4000"

# --- start the web app's dev server -----------------------------------------
log "Starting the web app (vite dev)..."
( cd "$WEB_DIR" && exec npm run dev ) >"$VITE_LOG" 2>&1 &
VITE_PID=$!
echo "  pid $VITE_PID, logging to $VITE_LOG"

echo "  waiting for the dev server to come up (up to ${VITE_READY_TIMEOUT}s)..."
ready=false
for _ in $(seq 1 "$VITE_READY_TIMEOUT"); do
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    warn "Vite dev server exited early. Last log lines:"
    tail -n 40 "$VITE_LOG" >&2
    exit 1
  fi
  if grep -qE "Local:[[:space:]]+http" "$VITE_LOG" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != "true" ]]; then
  warn "Vite dev server did not report ready within ${VITE_READY_TIMEOUT}s. Last log lines:"
  tail -n 40 "$VITE_LOG" >&2
  exit 1
fi
DEV_URL="$(grep -oE 'http://[^[:space:]]+' "$VITE_LOG" | head -1)"

log "Web app ready at ${DEV_URL:-see $VITE_LOG} (Ctrl+C to stop everything)"
tail -f "$VITE_LOG" &
TAIL_PID=$!

wait "$FIREBASE_PID"
