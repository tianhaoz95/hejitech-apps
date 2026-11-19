#!/usr/bin/env bash
# Writes services/web/.dev.vars for a local Worker: the local stack's service key, and a throwaway
# P-256 key as the APNs key so notifications are signed and sent (to test-api.mjs's receiver on
# 127.0.0.1:8851, set by wrangler.jsonc's local APNS_HOST; never to Apple). Run from anywhere
# after `supabase start`.
set -euo pipefail
cd "$(dirname "$0")/../../.."
key=$(openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 2>/dev/null | openssl pkcs8 -topk8 -nocrypt | awk 'NF{printf "%s\\n", $0}')
{
  echo "SUPABASE_SERVICE_ROLE_KEY=$(supabase status -o json 2>/dev/null | jq -r .SERVICE_ROLE_KEY)"
  echo "APNS_TEAM_ID=LOCALTEST1"
  echo "APNS_KEY_ID=LOCALKEY01"
  echo "APNS_PRIVATE_KEY=\"$key\""
} > projects/folio/services/web/.dev.vars
echo "wrote projects/folio/services/web/.dev.vars"
