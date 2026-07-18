#!/usr/bin/env bash
# Serves ./feedback/public locally for a quick visual check (styling, layout).
# python's http.server binds "localhost", so script.js's hostname check
# routes writes to the Firestore EMULATOR, not the real project — but no
# emulator is running here, so a submission will just fail. To actually test
# submissions, see ./scripts/run-feedback-with-emulators.sh instead.
# Usage: ./scripts/serve-feedback.sh [port]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEEDBACK_DIR="$(cd "$SCRIPT_DIR/../feedback/public" && pwd)"
PORT="${1:-8440}"
URL="http://localhost:${PORT}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but was not found on PATH." >&2
  exit 1
fi

echo "Serving ${FEEDBACK_DIR}"
echo "  -> ${URL}"
echo "Press Ctrl+C to stop."

if command -v open >/dev/null 2>&1; then
  ( sleep 0.7 && open "$URL" ) &
fi

cd "$FEEDBACK_DIR"
exec python3 -m http.server "$PORT"
