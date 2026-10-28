#!/usr/bin/env bash
# Scaffold a heji-report document site at reports/<date>-<slug>/ from the template next to this script.
#
#   .claude/skills/heji-report/new.sh <slug> "<Title>"   # → reports/2026-10-28-<slug>/
#
# Same folder, port and serve.sh conventions as heji-candidate-review's new.sh: the folder starts with
# today's date (a slug that already starts with one keeps it), and the port is the first from 8787 up
# that no other report (active or archived) uses and nothing is listening on, since browsers keep each
# page's ticks and notes per port.
# design.js and its stylesheet are copied from heji-candidate-review's template, the one real copy.
set -euo pipefail

SLUG="${1:?usage: new.sh <slug> \"<Title>\"}"
TITLE="${2:?usage: new.sh <slug> \"<Title>\"}"
[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "slug must be lowercase-kebab: $SLUG" >&2; exit 1; }
[[ "$SLUG" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}- ]] || SLUG="$(date +%F)-$SLUG"

SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SKILL" rev-parse --show-toplevel)"
CAND="$ROOT/.claude/skills/heji-candidate-review/template/site"
DEST="$ROOT/reports/$SLUG"
[[ -e "$DEST" ]] && { echo "$DEST already exists; edit it instead." >&2; exit 1; }

REPO="$(git -C "$ROOT" remote get-url origin 2>/dev/null | sed -E 's#^(git@[^:]+:|https?://[^/]+/)##; s#\.git$##' || true)"

used="$(grep -ho ':-[0-9]\{4,5\}' "$ROOT"/reports/*/script/serve.sh "$ROOT"/reports/archive/*/script/serve.sh 2>/dev/null | grep -o '[0-9]*' || true)"
PORT=8787
# Also skip a port something is serving right now (a report another session is still writing).
while grep -qx "$PORT" <<<"$used" || lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done

mkdir -p "$ROOT/reports"
cp -R "$SKILL/template" "$DEST"
rm -f "$DEST/site/media/.gitkeep"
cp "$CAND/js/design.js" "$DEST/site/js/design.js"
sed -n '/design section (js\/design.js)/,$p' "$CAND/css/site.css" > "$DEST/site/css/design.css"
[[ -s "$DEST/site/css/design.css" ]] || { echo "couldn't extract the design styles from $CAND/css/site.css" >&2; exit 1; }

esc_title="$(printf '%s' "$TITLE" | sed 's/[&/\]/\\&/g')"
find "$DEST" -type f \( -name '*.html' -o -name '*.js' -o -name '*.sh' \) -print0 |
  xargs -0 sed -i '' -e "s/__SLUG__/$SLUG/g" -e "s/__TITLE__/$esc_title/g" -e "s/__PORT__/$PORT/g" \
    -e "s/__DATE__/$(date +%F)/g" -e "s#__REPO__#${REPO:-<owner>/<repo>}#g"
chmod +x "$DEST/script/serve.sh"

echo "Created $DEST (port $PORT)"
echo "Edit:   reports/$SLUG/site/index.html (sections) and site/js/content.js (REPORT config, design blocks)"
echo "Serve:  reports/$SLUG/script/serve.sh"
