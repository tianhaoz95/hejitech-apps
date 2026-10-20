#!/usr/bin/env bash
# Scaffold a heji-candidate-review site at reports/<slug>/ from the template next to this script.
#
#   .claude/skills/heji-candidate-review/new.sh <slug> "<Title>"
#
# Picks the first port from 8787 up that no other report (active or in reports/archive/) already uses:
# browsers keep each site's hearts and ratings per port, so a reused port would mix two reviews.
set -euo pipefail

SLUG="${1:?usage: new.sh <slug> \"<Title>\"}"
TITLE="${2:?usage: new.sh <slug> \"<Title>\"}"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "slug must be lowercase-kebab: $SLUG" >&2; exit 1; }

SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SKILL" rev-parse --show-toplevel)"
DEST="$ROOT/reports/$SLUG"
[[ -e "$DEST" ]] && { echo "$DEST already exists; edit it instead (new round = new candidates in it)." >&2; exit 1; }
[[ -e "$ROOT/reports/archive/$SLUG" ]] && { echo "reports/archive/$SLUG exists; restore it (heji-archive-reports) or pick another slug." >&2; exit 1; }

REPO="$(git -C "$ROOT" remote get-url origin 2>/dev/null | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##' || true)"

used="$(grep -ho ':-[0-9]\{4,5\}' "$ROOT"/reports/*/script/serve.sh "$ROOT"/reports/archive/*/script/serve.sh 2>/dev/null | grep -o '[0-9]*' || true)"
PORT=8787
while grep -qx "$PORT" <<<"$used"; do PORT=$((PORT + 1)); done

mkdir -p "$ROOT/reports"
cp -R "$SKILL/template" "$DEST"
esc_title="$(printf '%s' "$TITLE" | sed 's/[&/\]/\\&/g')"
find "$DEST" -type f \( -name '*.html' -o -name '*.js' -o -name '*.sh' \) -print0 |
  xargs -0 sed -i '' -e "s/__SLUG__/$SLUG/g" -e "s/__TITLE__/$esc_title/g" -e "s/__PORT__/$PORT/g" -e "s#__REPO__#${REPO:-<owner>/<repo>}#g"
chmod +x "$DEST/script/serve.sh"

echo "Created $DEST (port $PORT)"
echo "Serve:  reports/$SLUG/script/serve.sh"
