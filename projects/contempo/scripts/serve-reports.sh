#!/usr/bin/env bash
# Serves ./reports locally for review. Usage: ./scripts/serve-reports.sh [port]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORTS_DIR="$(cd "$SCRIPT_DIR/../reports" && pwd)"
PORT="${1:-8420}"
URL="http://localhost:${PORT}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but was not found on PATH." >&2
  exit 1
fi

echo "Serving ${REPORTS_DIR}"
echo "  -> ${URL}"
echo "Press Ctrl+C to stop."

if command -v open >/dev/null 2>&1; then
  ( sleep 0.7 && open "$URL" ) &
fi

cd "$REPORTS_DIR"
exec python3 -m http.server "$PORT"
