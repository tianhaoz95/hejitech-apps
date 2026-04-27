#!/bin/bash

# dev-all.sh - Start full local environment and cleanup on exit
# Compatible with macOS and Linux
#
# Behavior:
#   Apps (Hub / Admin / Landing):  Vite HMR — browser auto-refreshes on every save
#   Extension:                     Plasmo watch — rebuilds on every save, reload manually
#                                  in chrome://extensions after each rebuild

EMULATOR_PID=""
STRIPE_PID=""
MAIN_PID=""
USE_PROD=false

# Parse arguments
for arg in "$@"; do
    if [ "$arg" == "--prod" ]; then
        USE_PROD=true
        shift
    fi
done

cleanup() {
    echo ""
    echo "Shutting down environment..."

    # Remove the trap to prevent recursion
    trap - SIGINT SIGTERM EXIT

    [ -n "$EMULATOR_PID" ] && kill -2 "$EMULATOR_PID" 2>/dev/null
    [ -n "$STRIPE_PID"   ] && kill -2 "$STRIPE_PID"   2>/dev/null
    [ -n "$MAIN_PID"     ] && kill -2 "$MAIN_PID"     2>/dev/null
    
    # Ensure we kill the process group for stripe listen
    if [ "$USE_PROD" = false ] && [ -n "$STRIPE_PID" ]; then
       pkill -P "$STRIPE_PID" 2>/dev/null || true
    fi

    # Remove per-run env overrides
    for app in extension hub admin; do
        rm -f "apps/$app/.env.local"
    done

    echo "Cleanup complete."
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# File-watching backends (improves reliability on macOS / Linux)
export CHOKIDAR_USEPOLLING=true
export PARCEL_WATCHER_BACKEND=brute-force

# ── Environment setup ─────────────────────────────────────────────────────────

if [ "$USE_PROD" = true ]; then
    echo "Initializing Icecap PRODUCTION environment (real Firebase)..."
    export PLASMO_PUBLIC_USE_EMULATOR=false
    export VITE_USE_EMULATOR=false

    for app in extension hub admin; do
        printf 'PLASMO_PUBLIC_USE_EMULATOR=false\nVITE_USE_EMULATOR=false\n' > "apps/$app/.env.local"
    done

    # Clear Plasmo cache so the new env is picked up cleanly
    rm -rf apps/extension/.plasmo apps/extension/build
else
    echo "Initializing Icecap LOCAL environment (Firebase emulator)..."
    export PLASMO_PUBLIC_USE_EMULATOR=true
    export VITE_USE_EMULATOR=true
    export STRIPE_USE_MOCK=false

    for app in extension hub admin; do
        printf 'PLASMO_PUBLIC_USE_EMULATOR=true\nVITE_USE_EMULATOR=true\n' > "apps/$app/.env.local"
    done
fi

# ── Port cleanup ──────────────────────────────────────────────────────────────

echo "Freeing emulator ports..."
PIDS=$(lsof -ti:4000,9099,8080,5001,5002 2>/dev/null)
[ -n "$PIDS" ] && echo "$PIDS" | xargs kill -9 2>/dev/null || true

# ── Background services ───────────────────────────────────────────────────────

if [ "$USE_PROD" = false ]; then
    echo "Starting Firebase emulator..."
    pnpm run emulator > .emulator.log 2>&1 &
    EMULATOR_PID=$!

    echo "Waiting for emulator UI..."
    count=0
    while ! curl -s http://127.0.0.1:4000 > /dev/null; do
        sleep 2
        count=$((count + 1))
        if [ $count -gt 15 ]; then
            echo "Emulator taking longer than expected, continuing anyway..."
            break
        fi
    done

    echo "Seeding emulator data..."
    pnpm run emulator:seed
    sleep 2

    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://127.0.0.1:4000
    fi

    echo "Starting Stripe CLI listener..."
    if ! command -v stripe &> /dev/null; then
        echo "⚠️  Stripe CLI not found. Please install it."
    else
        stripe listen --forward-to localhost:5001/demo-icecap/us-central1/stripeWebhook > .stripe-cli.log 2>&1 &
        STRIPE_PID=$!
        echo "✅ Stripe CLI listener backgrounded (PID: $STRIPE_PID). Logs: .stripe-cli.log"
    fi
fi

# ── Apps: background (Vite HMR → browser auto-refreshes on save) ─────────────

echo "Starting Hub / Admin / Landing dev servers (HMR)..."
pnpm turbo run dev --parallel \
    --filter=!@icecap/extension > .turbo.log 2>&1 &
MAIN_PID=$!
echo "Apps running in background. Logs: .turbo.log"

# ── Extension: initial build so it can be loaded immediately ─────────────────
# Both modes output to chrome-mv3-dev.  "prod" vs "local" is purely the
# PLASMO_PUBLIC_USE_EMULATOR env var — not the directory name.

echo ""
echo "Building extension (initial)..."
(cd apps/extension && pnpm plasmo build --target=chrome-mv3 --tag=dev) 2>&1 | tee .extension.log

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Load or reload the extension from:"
echo "  apps/extension/build/chrome-mv3-dev"
echo "  in chrome://extensions (enable Developer mode first)"
echo ""
echo "  Apps:      Vite HMR active — browser tabs refresh automatically"
echo "  Extension: Plasmo watch active — reload manually after each rebuild"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Press Ctrl+C once to stop everything."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Extension: watch mode in foreground ───────────────────────────────────────
# pnpm dev (Plasmo) crashes on Node 24 via @parcel/watcher FSEvents bug.
# scripts/watch-extension.js uses chokidar polling as a reliable replacement.

node scripts/watch-extension.js 2>&1 | tee -a .extension.log

# Extension dev server exited on its own — clean up everything
cleanup
