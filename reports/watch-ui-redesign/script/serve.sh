#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE_DIR="$(cd "${SCRIPT_DIR}/../site" && pwd)"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is required to serve the site locally."
  exit 1
fi

echo "Starting Voxbrief Watch UI Redesign Studio..."
exec python3 "${SCRIPT_DIR}/serve.py"
