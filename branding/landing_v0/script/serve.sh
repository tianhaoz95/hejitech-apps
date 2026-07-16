#!/usr/bin/env bash
# Serves the Contempo landing page mockup locally. Usage: ./serve.sh [port]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(cd "$SCRIPT_DIR/../site" && pwd)"
PORT="${1:-8430}"
URL="http://localhost:${PORT}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but was not found on PATH." >&2
  exit 1
fi

echo "Serving ${SITE_DIR}"
echo "  -> ${URL}"
echo "Press Ctrl+C to stop."

if command -v open >/dev/null 2>&1; then
  ( sleep 0.7 && open "$URL" ) &
fi

cd "$SITE_DIR"
exec python3 -m http.server "$PORT"
