#!/usr/bin/env bash
# Serve the __TITLE__ review site locally and open it in the browser.
#
#   reports/__SLUG__/script/serve.sh            # http://localhost:__PORT__
#   reports/__SLUG__/script/serve.sh 9000       # custom port
#   NO_OPEN=1 reports/__SLUG__/script/serve.sh  # don't open a browser
#   PHONE=1 reports/__SLUG__/script/serve.sh    # also on this Mac's Tailscale address, to review on a phone
set -euo pipefail

SITE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../site" && pwd)"
PORT="${1:-__PORT__}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is busy. Pass another one: $0 <port>" >&2
  exit 1
fi

# PHONE=1: a second server bound to the Tailscale IPv4 only (never 0.0.0.0: not the LAN, not the internet).
# Plain http on that address isn't a "secure context", so the page's Copy buttons use their fallback
# (execCommand, then a select-and-copy sheet); see the skill's "Mobile" notes.
TS_IP=""
if [[ -n "${PHONE:-}" ]]; then
  for ts in tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale; do
    TS_IP="$("$ts" ip -4 2>/dev/null | head -1 || true)"
    [[ -n "$TS_IP" ]] && break
  done
  [[ -n "$TS_IP" ]] || { echo "PHONE=1 needs Tailscale running on this Mac (tailscale ip -4 found nothing)." >&2; exit 1; }
fi

URL="http://localhost:$PORT/"
echo "Serving $SITE"
echo "→ $URL   (Ctrl-C to stop)"
[[ -n "$TS_IP" ]] && echo "→ http://$TS_IP:$PORT/   (phone, over Tailscale)"

if [[ -z "${NO_OPEN:-}" ]]; then
  (sleep 0.7; open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null || true) &
fi

if command -v python3 >/dev/null 2>&1; then
  serve() { python3 -m http.server "$PORT" --bind "$1" --directory "$SITE"; }
elif command -v npx >/dev/null 2>&1; then
  serve() { npx --yes http-server "$SITE" -p "$PORT" -a "$1" -c-1 --silent; }
else
  echo "Need python3 or node (npx) to serve the site." >&2
  exit 1
fi

if [[ -n "$TS_IP" ]]; then
  serve "$TS_IP" &
  trap 'kill $! 2>/dev/null || true' EXIT INT TERM
fi
serve 127.0.0.1
