#!/bin/bash

# Script to deploy Firebase Remote Config template
PROJECT_ARG=""
if [ ! -z "$1" ]; then
    PROJECT_ARG="-P $1"
fi

ACTIVE_PROJECT=$(firebase target:list 2>/dev/null | grep -o 'Project: .*' || echo "default")
echo "🚀 Deploying Firebase Remote Config to $ACTIVE_PROJECT..."

if ! command -v firebase &> /dev/null
then
    echo "❌ Error: Firebase CLI not found. Please install it with 'npm install -g firebase-tools'."
    exit 1
fi

firebase deploy --only remoteconfig $PROJECT_ARG

if [ $? -eq 0 ]; then
    echo "✅ Remote Config deployed successfully!"
else
    echo "❌ Failed to deploy Remote Config."
    exit 1
fi
