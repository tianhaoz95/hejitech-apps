#!/usr/bin/env bash
# Serves the v0 walkthrough site at http://127.0.0.1:8765 (or $PORT_SITE).
set -euo pipefail
SITE="$(cd "$(dirname "$0")/../site" && pwd)"
PORT="${PORT_SITE:-8765}"
echo "Wee Hours v0 report → http://127.0.0.1:${PORT}"
( sleep 1; command -v open >/dev/null && open "http://127.0.0.1:${PORT}" ) &
exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE"
