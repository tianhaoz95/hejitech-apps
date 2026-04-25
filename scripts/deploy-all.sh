#!/bin/bash
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "🚀 Building all apps..."
pnpm turbo run build

echo "📦 Deploying to Firebase Hosting (Production)..."

# Check if FIREBASE_TOKEN is set (optional if using other auth methods)
if [ -z "$FIREBASE_TOKEN" ]; then
  echo "⚠️ FIREBASE_TOKEN is not set. Assuming other auth methods are configured."
fi

# Deploy everything in firebase.json hosting array using the production alias
pnpm exec firebase deploy --only hosting --project production --non-interactive
