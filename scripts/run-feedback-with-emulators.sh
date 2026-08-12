#!/usr/bin/env bash
# Starts the Firebase emulator suite and a plain python3 http.server for
# feedback/public together (both talk over "localhost" — script.js routes to
# the Firestore emulator automatically when location.hostname is
# localhost/127.0.0.1). Ctrl+C (or any exit) tears both down together.
#
# Usage: ./scripts/run-feedback-with-emulators.sh [firebase-project-id] [port]
#   Defaults to "contempo-str", NOT "demo-contempo" like the other
#   run-*-with-emulators.sh scripts — unlike web/ (which reads its project id
#   from web/.env.local at build time), feedback/public/assets/firebase-config.js
#   is a committed, zero-build static file that always hardcodes
#   projectId: "contempo-str". The Firestore/Auth emulators partition
#   data BY PROJECT ID, so starting this against any other project id means
#   the site's writes land in a namespace this script never points you at.
#   Sharing the "contempo-str" id here is still safe — the emulator
#   suite is a fully local, in-memory implementation that never talks to the
#   real cloud project no matter which project id it's told to use.
set -euo pipefail
set -m # give the emulator suite its own process group so it can be killed as a unit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FEEDBACK_DIR="$ROOT_DIR/feedback/public"
BACKEND_DIR="$ROOT_DIR/backend"

PROJECT_ID="${1:-contempo-str}"
PORT="${2:-8440}"
URL="http://localhost:${PORT}"

EMULATOR_LOG="$(mktemp -t contempo-emulators.XXXXXX.log)"
EMULATOR_READY_TIMEOUT=90

FIREBASE_PID=""
HTTP_PID=""

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf '\n!! %s\n' "$*" >&2; }

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM
  log "Shutting down..."

  if [[ -n "$HTTP_PID" ]] && kill -0 "$HTTP_PID" 2>/dev/null; then
    kill "$HTTP_PID" 2>/dev/null || true
    wait "$HTTP_PID" 2>/dev/null || true
    echo "  feedback/public server stopped"
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

  rm -f "$EMULATOR_LOG"
  log "All services stopped."
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

if ! command -v firebase >/dev/null 2>&1; then
  warn "Could not find the firebase CLI on PATH (npm install -g firebase-tools)."
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  warn "python3 is required but was not found on PATH."
  exit 1
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

# --- serve feedback/public ---------------------------------------------------
log "Serving feedback/public..."
( cd "$FEEDBACK_DIR" && exec python3 -m http.server "$PORT" ) >/dev/null 2>&1 &
HTTP_PID=$!
echo "  pid $HTTP_PID"

log "Feedback site ready at ${URL} (Ctrl+C to stop everything)"
if command -v open >/dev/null 2>&1; then
  ( sleep 0.7 && open "$URL" ) &
fi

wait "$FIREBASE_PID"
