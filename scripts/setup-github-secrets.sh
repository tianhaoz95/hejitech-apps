#!/bin/bash
# scripts/setup-github-secrets.sh - Upload Firebase credentials to GitHub Secrets

set -e

KEY_FILE="icecap-platform-firebase-adminsdk-fbsvc-ec78305d55.json"
REPO="tianhaoz95/icecap"

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Error: $KEY_FILE not found in the root directory."
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo "❌ Error: 'gh' CLI is not installed. Please install it first: https://cli.github.com/"
    exit 1
fi

echo "🚀 Uploading $KEY_FILE to GitHub Secret: FIREBASE_SERVICE_ACCOUNT..."
gh secret set FIREBASE_SERVICE_ACCOUNT --repo "$REPO" < "$KEY_FILE"

echo "✅ Done! Your service account key is now available to GitHub Actions."
echo "ℹ️  Note: Ensure you have also set FIREBASE_TOKEN if needed for hosting deployments."
