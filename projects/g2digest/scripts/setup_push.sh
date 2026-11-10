#!/usr/bin/env bash
# One-time production setup for "your edition is ready" notifications on the iPhone app:
# the push_devices table, then the Worker's APNs secrets (the team's APNs key from ~/Credentials;
# one key serves every app of team 68CTFST8W2, the topic is the bundle id). Safe to run again.
#
#   projects/g2digest/scripts/setup_push.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
set -a; . ~/Credentials/hejitech-apps.env; set +a
. projects/g2digest/backend.env   # SUPABASE_REF: this project's backend
[ -f "${HEJI_APNS_KEY_P8_LOCATION:-}" ] || { echo "!! no APNs key file (HEJI_APNS_KEY_P8_LOCATION)" >&2; exit 1; }

echo "==> database: pending migrations (should be only g2digest_push_devices)"
supabase db push --remote "$SUPABASE_REF" --dry-run
supabase db push --remote "$SUPABASE_REF"

echo "==> Worker secrets (g2digest, production)"
cd projects/g2digest/services/web
printf '%s' "68CTFST8W2" | npx wrangler secret put APNS_TEAM_ID --env production
printf '%s' "$HEJI_APNS_KEY_ID" | npx wrangler secret put APNS_KEY_ID --env production
npx wrangler secret put APNS_PRIVATE_KEY --env production < "$HEJI_APNS_KEY_P8_LOCATION"
echo "==> done: the iPhone app's Settings → Notifications now registers, and each publish notifies"
