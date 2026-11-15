#!/usr/bin/env bash
# Gives Pro to an email address for free: testers, early adopters, friends, the owner. Each project
# keeps its own list (<schema>.pro_grants, keyed by the lower-case email), so a grant works before
# the person first signs in, and on every device they sign in on. The iPhone app's purchase screen
# has "Have a Pro invite? Sign in" (Headway, FitLoop, G2 Digest ask GET /api/pro); Waypack counts a
# grant in its plan everywhere (iPhone, Mac, web, MCP). Skill: heji-app-store-iap ("Free Pro").
#
#   scripts/grant_pro.sh <project> <email>                      # Pro for good
#   scripts/grant_pro.sh <project> <email> --until 2027-06-30   # Pro until that day (UTC midnight)
#   scripts/grant_pro.sh <project> <email> --note "beta tester" # a note for the list (any command)
#   scripts/grant_pro.sh <project> <email> --revoke             # take it back
#   scripts/grant_pro.sh <project> --list                       # everyone with a grant
#   add --local to any of them to use the local stack (supabase start) instead of production
#
# Production writes go through the project's PostgREST with the Supabase secret key: SUPABASE_SECRET_KEY
# from the environment, else ~/Credentials/waypack.env (the shared HEJI project's key, named after
# its first user) for BACKEND=shared projects, or ~/Credentials/<project>.env once a project graduates.
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "!! $*" >&2; exit 1; }
usage="usage: scripts/grant_pro.sh <project> <email> [--until YYYY-MM-DD] [--note TEXT] [--revoke] | <project> --list   [--local]"
PROJECT="${1:-}"; shift || true
[ -n "$PROJECT" ] || die "$usage"
EMAIL="" UNTIL="" NOTE="" REVOKE=false LIST=false LOCAL=false
while [ $# -gt 0 ]; do
  case "$1" in
    --until) UNTIL="${2:-}"; shift ;;
    --note) NOTE="${2:-}"; shift ;;
    --revoke) REVOKE=true ;;
    --list) LIST=true ;;
    --local) LOCAL=true ;;
    -*) die "unknown option $1" ;;
    *) [ -z "$EMAIL" ] || die "$usage"; EMAIL="$1" ;;
  esac
  shift
done

ENVFILE="projects/$PROJECT/backend.env"
[ -f "$ENVFILE" ] || die "no $ENVFILE"
grep -q "create table $PROJECT.pro_grants" "supabase/schemas/$PROJECT/"*.sql 2>/dev/null \
  || die "$PROJECT has no pro_grants table (supabase/schemas/$PROJECT/): add it first (skill heji-app-store-iap)"
# shellcheck source=/dev/null
source "$ENVFILE"
SCHEMA="${SCHEMA:-$PROJECT}"

if $LOCAL; then
  STATUS="$(supabase status -o env 2>/dev/null)" || die "the local stack isn't running (supabase start)"
  URL="$(echo "$STATUS" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
  KEY="$(echo "$STATUS" | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
  WHERE="local stack"
else
  URL="${SUPABASE_URL:?$ENVFILE has no SUPABASE_URL}"
  KEY="${SUPABASE_SECRET_KEY:-}"
  if [ -z "$KEY" ]; then
    CRED="$HOME/Credentials/$([ "${BACKEND:-shared}" = shared ] && echo waypack || echo "$PROJECT").env"
    KEY="$(grep -E '^SUPABASE_SECRET_KEY=' "$CRED" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)"
    [ -n "$KEY" ] || die "no SUPABASE_SECRET_KEY in the environment or $CRED"
  fi
  WHERE="production ($URL)"
fi
[ -n "$URL" ] && [ -n "$KEY" ] || die "couldn't work out the database URL or key"

rest() {  # rest <method> <path?query> [json body]
  curl -sS -X "$1" "$URL/rest/v1/$2" \
    -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
    -H "Accept-Profile: $SCHEMA" -H "Content-Profile: $SCHEMA" \
    -H "Content-Type: application/json" -H "Prefer: return=representation,resolution=merge-duplicates" \
    ${3:+--data "$3"} -w '\n%{http_code}'
}
check() {  # prints the body, dies on a non-2xx status
  local out="$1" code body
  code="$(echo "$out" | tail -1)"; body="$(echo "$out" | sed '$d')"
  [[ "$code" =~ ^2 ]] || die "$WHERE answered $code: $body"
  echo "$body"
}
show() { jq -r '.[] | "  \(.email)\t\(if .until then "until \(.until[0:10])" else "for good" end)\t\(.note // "")"'; }

if $LIST; then
  echo "==> $PROJECT Pro grants, $WHERE"
  check "$(rest GET "pro_grants?select=email,until,note,granted_at&order=granted_at.asc")" | show
  exit 0
fi

[ -n "$EMAIL" ] || die "$usage"
EMAIL="$(echo "$EMAIL" | tr '[:upper:]' '[:lower:]' | xargs)"
[[ "$EMAIL" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]] || die "not an email address: $EMAIL"

if $REVOKE; then
  body="$(check "$(rest DELETE "pro_grants?email=eq.$(jq -rn --arg e "$EMAIL" '$e|@uri')")")"
  [ "$(echo "$body" | jq length)" -gt 0 ] && echo "==> $PROJECT: took Pro back from $EMAIL ($WHERE)" \
    || echo "==> $PROJECT: $EMAIL had no grant ($WHERE)"
  exit 0
fi

if [ -n "$UNTIL" ]; then
  [[ "$UNTIL" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || die "--until wants YYYY-MM-DD, got $UNTIL"
  UNTIL_TS="${UNTIL}T00:00:00Z"
fi
row="$(jq -nc --arg e "$EMAIL" --arg u "${UNTIL_TS:-}" --arg n "$NOTE" \
  '{email: $e, until: (if $u == "" then null else $u end)} + (if $n == "" then {} else {note: $n} end)')"
echo "==> $PROJECT: Pro for $EMAIL, $([ -n "$UNTIL" ] && echo "until $UNTIL" || echo "for good") ($WHERE)"
check "$(rest POST "pro_grants?on_conflict=email" "$row")" | show
