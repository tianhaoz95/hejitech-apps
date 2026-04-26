#!/bin/bash

# dev-all.sh - Start full local environment and cleanup on exit
# Compatible with macOS and Linux

EMULATOR_PID=""
STRIPE_PID=""
EXTENSION_PID=""
USE_PROD=false

# Parse arguments
for arg in "$@"; do
    if [ "$arg" == "--prod" ]; then
        USE_PROD=true
        shift
    fi
done

cleanup() {
    # Save exit status
    STATUS=$?
    
    echo ""
    echo "🛑 Shutting down environment..."
    
    # Ignore further signals to avoid recursion
    trap - SIGINT SIGTERM EXIT

    # Use SIGINT (2) for graceful shutdown of dev servers
    if [ -n "$EMULATOR_PID" ]; then
        echo "Killing Firebase Emulator (PID: $EMULATOR_PID)..."
        kill -2 $EMULATOR_PID 2>/dev/null
    fi
    
    if [ -n "$STRIPE_PID" ]; then
        echo "Killing Stripe Mock (PID: $STRIPE_PID)..."
        kill -2 $STRIPE_PID 2>/dev/null
    fi

    if [ -n "$EXTENSION_PID" ]; then
        echo "Killing Extension Dev (PID: $EXTENSION_PID)..."
        kill -2 $EXTENSION_PID 2>/dev/null
    fi

    if [ -n "$MAIN_PID" ]; then
        echo "Killing Main Dev Servers (PID: $MAIN_PID)..."
        kill -2 $MAIN_PID 2>/dev/null
    fi

    # Remove prod env overrides
    for app in extension hub admin; do
        rm -f "apps/$app/.env.local"
    done
    
    echo "✅ Cleanup complete."
    exit 0
}

# Trap signals and script exit
trap cleanup SIGINT SIGTERM EXIT

if [ "$USE_PROD" = true ]; then
    echo "🚀 Initializing Icecap PRODUCTION Environment (using real Firebase)..."
    export PLASMO_PUBLIC_USE_EMULATOR=false
    export VITE_USE_EMULATOR=false

    # Override USE_EMULATOR via .env.local so .env is never modified
    for app in extension hub admin; do
        printf 'PLASMO_PUBLIC_USE_EMULATOR=false\nVITE_USE_EMULATOR=false\n' > "apps/$app/.env.local"
        echo "📦 Created apps/$app/.env.local (USE_EMULATOR=false override)"
    done
    # Clean up any stale .env.bak files from old script versions
    for app in extension hub admin; do
        rm -f "apps/$app/.env.bak"
    done
    
    echo "🧹 Clearing Plasmo cache and build artifacts to ensure environment update..."
    rm -rf apps/extension/.plasmo
    rm -rf apps/extension/build
else
    echo "🚀 Initializing Icecap Local Environment..."
    export PLASMO_PUBLIC_USE_EMULATOR=true
    export VITE_USE_EMULATOR=true
fi

# Initial cleanup to ensure ports are free
echo "🧹 Cleaning up existing processes on emulator and mock ports..."
PIDS=$(lsof -ti:4000,9099,8080,5001,5002,12111 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi

if [ "$USE_PROD" = false ]; then
    # Start Firebase Emulator
    echo "Starting Firebase Emulator..."
    pnpm run emulator > .emulator.log 2>&1 &
    EMULATOR_PID=$!
    echo "✅ Emulator backgrounded (PID: $EMULATOR_PID). Logs: .emulator.log"
fi

# Start Stripe Mock
echo "Starting Stripe Mock..."
pnpm run dev:stripe-mock > .stripe-mock.log 2>&1 &
STRIPE_PID=$!
echo "✅ Stripe Mock backgrounded (PID: $STRIPE_PID). Logs: .stripe-mock.log"

if [ "$USE_PROD" = false ]; then
    echo "⏳ Waiting for services to initialize..."
    # Wait for emulator to be reachable
    count=0
    while ! curl -s http://127.0.0.1:4000 > /dev/null; do
        sleep 2
        count=$((count + 1))
        if [ $count -gt 15 ]; then
            echo "⚠️ Emulator UI taking a long time to start. Continuing..."
            break
        fi
    done

    echo "🌱 Seeding emulator data..."
    pnpm run emulator:seed
    sleep 2

    echo "🌍 Opening Firebase Emulator UI..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://127.0.0.1:4000
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open http://127.0.0.1:4000 2>/dev/null || echo "Please open http://127.0.0.1:4000 manually"
    fi
fi

echo "🚀 Starting application dev servers..."
if [ "$USE_PROD" = true ]; then
    echo "🏗️  Building extension for production testing..."
    (cd apps/extension && pnpm build:chrome) 2>&1 | tee .extension.log
    BUILD_STATUS=${PIPESTATUS[0]}
    if [ $BUILD_STATUS -ne 0 ]; then
        echo "❌ Extension build FAILED (exit $BUILD_STATUS). See .extension.log for details."
        exit 1
    fi
    echo "✅ Extension built. Folder: apps/extension/build/chrome-mv3-prod"
    echo "⚠️  IMPORTANT: Please LOAD or RELOAD the extension from apps/extension/build/chrome-mv3-prod in chrome://extensions"
else
    # Start extension dev server in background
    echo "🕒 Starting extension dev server (HMR enabled)..."
    (cd apps/extension && CHOKIDAR_USEPOLLING=true pnpm dev > ../../.extension.log 2>&1) &
    EXTENSION_PID=$!
    echo "✅ Extension dev server backgrounded (PID: $EXTENSION_PID). Logs: .extension.log"
    echo "⚠️  IMPORTANT: Please LOAD the extension from apps/extension/build/chrome-mv3-dev in chrome://extensions"
fi

# Start the rest of the apps (Hub, Admin, Landing, etc.)
# We run this in the background to catch signals in the parent shell script.
pnpm turbo run dev --parallel --filter=!@icecap/extension --filter=!@icecap/stripe-mock > .turbo.log 2>&1 &
MAIN_PID=$!
echo "✅ Hub/Admin/Landing backgrounded (PID: $MAIN_PID). Logs: .turbo.log"

echo ""
echo "✨ All systems active! Logs are being streamed to hidden .*.log files."
echo "🛑 Press Ctrl+C once to shut down everything gracefully."
echo ""

# Wait for the main dev process to keep the script alive.
# The trap will handle the Ctrl+C signal and trigger cleanup.
wait $MAIN_PID

# If turbo exits naturally, trigger cleanup
cleanup
