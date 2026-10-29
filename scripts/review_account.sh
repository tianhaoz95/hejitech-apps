#!/usr/bin/env bash
# Sets up (or rotates) a project's App Review demo account in production. The skill
# heji-review-account explains the design; per-project settings are in projects/<name>/review.env.
#
#   scripts/review_account.sh <project> --dry-run    # look first
#   scripts/review_account.sh <project>              # set it up (keeps an existing password)
#   scripts/review_account.sh <project> --rotate     # new password everywhere
#   scripts/review_account.sh <project> --asc-only   # only (re)write App Store Connect
#
# 1. The password: generated once, kept outside the repo in ~/Credentials/review-accounts.env
#    (<PROJECT>_REVIEW_PASSWORD=…, mode 600). Never committed, never in the Worker in clear.
# 2. The project's Worker secrets REVIEW_EMAIL and REVIEW_PASSWORD_SHA256 (wrangler secret put).
# 3. Checks the production sign-in (POST /api/review-sign-in): a session for REVIEW_EMAIL. This
#    also resets the account to the demo state, as every review sign-in does.
# 4. App Store Connect › App Review Information of the editable version: sign-in required, the
#    account, the notes (scripts/asc_review_details.mjs; ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_PATH,
#    or the FA_ASC_* variables from the shell profile). No editable version yet: rerun with
#    --asc-only once there is one.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${1:-}"; shift || true
DRY=false ROTATE=false ASC_ONLY=false
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=true ;; --rotate) ROTATE=true ;; --asc-only) ASC_ONLY=true ;;
    *) echo "!! unknown option $a" >&2; exit 2 ;;
  esac
done
die() { echo "!! $*" >&2; exit 1; }
[ -n "$PROJECT" ] || die "usage: scripts/review_account.sh <project> [--dry-run|--rotate|--asc-only]"
CONF="projects/$PROJECT/review.env"
[ -f "$CONF" ] || die "no $CONF (the skill heji-review-account sets a project up)"
# shellcheck source=/dev/null
source "$CONF"
for v in REVIEW_EMAIL WORKER_DIR SITE BUNDLE_ID REVIEW_NOTES; do [ -n "${!v:-}" ] || die "$CONF: $v is empty"; done
WRANGLER_ENV="${WRANGLER_ENV:-production}"

STORE="$HOME/Credentials/review-accounts.env"
KEY="$(echo "$PROJECT" | tr '[:lower:]-' '[:upper:]_')_REVIEW_PASSWORD"
touch "$STORE"; chmod 600 "$STORE"
PASSWORD="$(grep -E "^$KEY=" "$STORE" | tail -1 | cut -d= -f2- || true)"
if [ -z "$PASSWORD" ] || $ROTATE; then
  $ASC_ONLY && [ -z "$PASSWORD" ] && die "--asc-only but no password in $STORE yet: run without it first"
  PASSWORD="$(set +o pipefail; LC_ALL=C tr -dc 'A-HJ-NP-Za-km-z2-9' < /dev/urandom | head -c 20)"
  NEW=true
else
  NEW=false
fi
HASH="$(printf '%s' "$PASSWORD" | shasum -a 256 | cut -d' ' -f1)"

echo "==> $PROJECT: demo account $REVIEW_EMAIL ($($NEW && echo "new password" || echo "existing password from $STORE"))"
if $DRY; then
  echo "    would: store the password in $STORE, set REVIEW_EMAIL + REVIEW_PASSWORD_SHA256 on the $WRANGLER_ENV Worker ($WORKER_DIR),"
  echo "           check $SITE/api/review-sign-in, write App Store Connect review details for $BUNDLE_ID"
  exit 0
fi

if ! $ASC_ONLY; then
  if $NEW; then
    grep -vE "^$KEY=" "$STORE" > "$STORE.tmp" || true
    echo "$KEY=$PASSWORD" >> "$STORE.tmp"
    mv "$STORE.tmp" "$STORE"; chmod 600 "$STORE"
  fi
  echo "==> Worker secrets ($WORKER_DIR, --env $WRANGLER_ENV)"
  (cd "$WORKER_DIR" && printf '%s' "$REVIEW_EMAIL" | npx wrangler secret put REVIEW_EMAIL --env "$WRANGLER_ENV" >/dev/null \
    && printf '%s' "$HASH" | npx wrangler secret put REVIEW_PASSWORD_SHA256 --env "$WRANGLER_ENV" >/dev/null)

  echo "==> checking the production sign-in"
  ok=false
  for _ in 1 2 3 4 5 6; do   # secrets take a few seconds to reach the Worker
    body="$(curl -s -X POST "$SITE/api/review-sign-in" -H 'Content-Type: application/json' \
      -d "{\"email\":\"$REVIEW_EMAIL\",\"password\":\"$PASSWORD\"}")"
    if echo "$body" | grep -q '"access_token"'; then ok=true; break; fi
    sleep 5
  done
  $ok || die "the production sign-in failed: $(echo "$body" | head -c 300) (is the Worker with /api/review-sign-in deployed?)"
  echo "    signed in as $REVIEW_EMAIL"
fi

echo "==> App Store Connect review details"
ASC_KEY_ID="${ASC_KEY_ID:-${FA_ASC_KEY_ID:-}}" ASC_ISSUER_ID="${ASC_ISSUER_ID:-${FA_ASC_ISSUER_ID:-}}" \
ASC_KEY_PATH="${ASC_KEY_PATH:-${FA_KEY_LOCATION:-}}" \
  node scripts/asc_review_details.mjs "$BUNDLE_ID" "$REVIEW_EMAIL" "$PASSWORD" <(printf '%s\n' "$REVIEW_NOTES") || {
  code=$?
  [ $code -eq 3 ] && { echo "    rerun with --asc-only once the version exists"; exit 0; }
  exit $code
}
