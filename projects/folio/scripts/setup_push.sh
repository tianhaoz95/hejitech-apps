#!/usr/bin/env bash
# One-time production setup for iPhone notifications: the Worker's APNs secrets (the team's APNs
# key from ~/Credentials; one key serves every app of team 68CTFST8W2, the topic is the bundle id
# com.hejitech.folio). The push_devices table comes with `supabase db push`. Safe to run again.
#
#   projects/folio/scripts/setup_push.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
set -a; . ~/Credentials/hejitech-apps.env; set +a
[ -f "${HEJI_APNS_KEY_P8_LOCATION:-}" ] || { echo "!! no APNs key file (HEJI_APNS_KEY_P8_LOCATION)" >&2; exit 1; }
cd projects/folio/services/web
printf '%s' "68CTFST8W2" | npx wrangler secret put APNS_TEAM_ID --env production
printf '%s' "$HEJI_APNS_KEY_ID" | npx wrangler secret put APNS_KEY_ID --env production
npx wrangler secret put APNS_PRIVATE_KEY --env production < "$HEJI_APNS_KEY_P8_LOCATION"
echo "==> done: the iPhone app's Settings → Notifications now registers, and agents' work notifies"
