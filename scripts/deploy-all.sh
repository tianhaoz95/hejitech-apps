#!/bin/bash
set -e

echo "🚀 Building all apps..."
pnpm turbo run build

echo "📦 Deploying to Firebase Hosting..."

# Deploy everything in firebase.json hosting array
# Explicitly use production project ID
npx firebase-tools deploy --only hosting --project icecap-platform --non-interactive --debug
