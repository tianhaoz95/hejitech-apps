#!/bin/bash
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

if [ -f "apps/hub/dist/index.html" ] && [ -d "firebase/functions/lib" ]; then
  echo "✨ Build artifacts found, skipping turbo build."
else
  echo "🚀 Building all apps and functions..."
  pnpm turbo run build
fi

echo "📦 Deploying to Firebase (Production)..."

# Check if FIREBASE_TOKEN is set (optional if using other auth methods)
if [ -z "$FIREBASE_TOKEN" ]; then
  echo "⚠️ FIREBASE_TOKEN is not set. Assuming other auth methods are configured."
fi

# Check firebase version
echo "🔥 Firebase Tools Version: $(npx firebase --version)"

# Deploy hosting to the production project
echo "📦 Deploying Hosting..."
npx firebase deploy --only hosting --project production --non-interactive --debug

# Deploy functions to the production project
echo "📦 Deploying Functions..."
npx firebase deploy --only functions --project production --non-interactive --debug --force
