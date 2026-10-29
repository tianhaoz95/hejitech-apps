#!/usr/bin/env bash
# Serve the Build proposals 2026-10-21 review site locally and open it in the browser.
#
#   reports/archive/2026-10-21-build-next-proposals/script/serve.sh            # http://localhost:8801
#   reports/archive/2026-10-21-build-next-proposals/script/serve.sh 9000       # custom port
#   NO_OPEN=1 reports/archive/2026-10-21-build-next-proposals/script/serve.sh  # don't open a browser
set -euo pipefail

SITE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../site" && pwd)"
PORT="${1:-8801}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is busy. Pass another one: $0 <port>" >&2
  exit 1
fi

URL="http://localhost:$PORT/"
echo "Serving $SITE"
echo "→ $URL   (Ctrl-C to stop)"

if [[ -z "${NO_OPEN:-}" ]]; then
  (sleep 0.7; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true) &
fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes http-server "$SITE" -p "$PORT" -a 127.0.0.1 -c-1 --silent
else
  echo "Need python3 or node (npx) to serve the site." >&2
  exit 1
fi
