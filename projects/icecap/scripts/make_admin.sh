#!/usr/bin/env bash
# Lets an account open Icecap's admin pages (/admin/): adds its user id to icecap.admins. The person
# must have signed in to Icecap (or any HEJI app: accounts are shared) once.
#
#   projects/icecap/scripts/make_admin.sh <email>            # production
#   projects/icecap/scripts/make_admin.sh <email> --revoke
#   projects/icecap/scripts/make_admin.sh --list
#   add --local to use the local stack (supabase start)
#
# Production uses the shared project's secret key: SUPABASE_SECRET_KEY from the environment, else
# ~/Credentials/waypack.env (same as scripts/grant_pro.sh).
set -euo pipefail
cd "$(dirname "$0")/../../.."
die() { echo "!! $*" >&2; exit 1; }

EMAIL="" REVOKE=false LIST=false LOCAL=false
for a in "$@"; do
  case "$a" in
    --revoke) REVOKE=true ;; --list) LIST=true ;; --local) LOCAL=true ;;
    -*) die "unknown option $a" ;; *) EMAIL="$(echo "$a" | tr '[:upper:]' '[:lower:]')" ;;
  esac
done
$LIST || [ -n "$EMAIL" ] || die "usage: make_admin.sh <email> [--revoke] | --list   [--local]"

# shellcheck source=/dev/null
source projects/icecap/backend.env
if $LOCAL; then
  STATUS="$(supabase status -o env 2>/dev/null)" || die "the local stack isn't running (supabase start)"
  URL="$(echo "$STATUS" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
  KEY="$(echo "$STATUS" | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"
else
  URL="$SUPABASE_URL"
  KEY="${SUPABASE_SECRET_KEY:-$(grep -E '^SUPABASE_SECRET_KEY=' "$HOME/Credentials/waypack.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)}"
fi
[ -n "$KEY" ] || die "no SUPABASE_SECRET_KEY in the environment or ~/Credentials/waypack.env"
H=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Accept-Profile: icecap" -H "Content-Profile: icecap" -H "Content-Type: application/json")

email_of() { curl -sS "${H[@]}" "$URL/auth/v1/admin/users/$1" | jq -r '.email // "?"'; }

if $LIST; then
  for id in $(curl -sS "${H[@]}" "$URL/rest/v1/admins?select=user_id" | jq -r '.[].user_id'); do echo "  $(email_of "$id")  $id"; done
  exit 0
fi

# Find the account by email (the admin API pages through every HEJI account).
ID="" PAGE=1
while [ -z "$ID" ]; do
  BATCH="$(curl -sS "${H[@]}" "$URL/auth/v1/admin/users?page=$PAGE&per_page=1000")"
  [ "$(echo "$BATCH" | jq '.users | length')" -gt 0 ] || break
  ID="$(echo "$BATCH" | jq -r --arg e "$EMAIL" '.users[] | select((.email // "" | ascii_downcase) == $e) | .id' | head -1)"
  PAGE=$((PAGE + 1))
done
[ -n "$ID" ] || die "no account with $EMAIL: sign in to Icecap once first"

if $REVOKE; then
  curl -sSf -X DELETE "${H[@]}" "$URL/rest/v1/admins?user_id=eq.$ID" >/dev/null
  echo "$EMAIL is no longer an Icecap admin"
else
  curl -sSf -X POST "${H[@]}" -H "Prefer: resolution=ignore-duplicates" "$URL/rest/v1/admins" --data "{\"user_id\":\"$ID\"}" >/dev/null
  echo "$EMAIL ($ID) is an Icecap admin"
fi
