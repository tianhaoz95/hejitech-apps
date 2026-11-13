#!/usr/bin/env bash
# Builds the dashboard (web/) and deploys the `feedback-kit` Worker (wrangler.jsonc).
# Cloudflare Workers Builds runs this on every push to main that touches projects/feedbackkit/
# (deploy command: `bash projects/feedbackkit/scripts/deploy-dashboard.sh`; other branches get
# `… deploy-dashboard.sh --preview`, a version upload); it works by hand too.
#
# The Supabase URL and publishable key are public values (they ship in the bundle) and come
# from backend.env, so the build needs no secrets.

set -euo pipefail
cd "$(dirname "$0")/.."

# shellcheck source=/dev/null
source backend.env

(
  cd web
  npm ci
  VITE_SUPABASE_URL="$SUPABASE_URL" VITE_SUPABASE_ANON_KEY="$SUPABASE_PUBLISHABLE_KEY" npm run build
)

if [[ "${1:-}" == "--preview" ]]; then
  shift
  npx --yes wrangler@4 versions upload "$@"   # non-production branches: a preview version
else
  npx --yes wrangler@4 deploy "$@"
fi
