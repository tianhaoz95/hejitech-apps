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
export PARCEL_WATCHER_BACKEND=polling

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

    for app in extension hub admin; do
        printf 'PLASMO_PUBLIC_USE_EMULATOR=true\nVITE_USE_EMULATOR=true\n' > "apps/$app/.env.local"
    done
fi

# ── Port cleanup ──────────────────────────────────────────────────────────────

echo "Freeing emulator and mock ports..."
PIDS=$(lsof -ti:4000,9099,8080,5001,5002,12111 2>/dev/null)
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
fi

echo "Starting Stripe mock..."
pnpm run dev:stripe-mock > .stripe-mock.log 2>&1 &
STRIPE_PID=$!

# ── Apps: background (Vite HMR → browser auto-refreshes on save) ─────────────

echo "Starting Hub / Admin / Landing dev servers (HMR)..."
pnpm turbo run dev --parallel \
    --filter=!@icecap/extension \
    --filter=!@icecap/stripe-mock > .turbo.log 2>&1 &
MAIN_PID=$!
echo "Apps running in background. Logs: .turbo.log"

# ── Extension: initial build so it can be loaded immediately ─────────────────

echo ""
if [ "$USE_PROD" = true ]; then
    echo "Building extension for production (chrome-mv3-prod)..."
    (cd apps/extension && pnpm build:chrome) 2>&1 | tee .extension.log
    LOAD_PATH="apps/extension/build/chrome-mv3-prod"
else
    echo "Building extension for local emulator (chrome-mv3-dev)..."
    (cd apps/extension && pnpm plasmo build --target=chrome-mv3 --tag=dev) 2>&1 | tee .extension.log
    LOAD_PATH="apps/extension/build/chrome-mv3-dev"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Load or reload the extension from:"
echo "  $LOAD_PATH"
echo "  in chrome://extensions (enable Developer mode first)"
echo ""
echo "  Apps:      Vite HMR active — browser tabs refresh automatically"
echo "  Extension: Plasmo watch active — rebuilds to chrome-mv3-dev, reload manually"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Press Ctrl+C once to stop everything."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Extension: watch mode in foreground ───────────────────────────────────────
# Running in the foreground means rebuild output is always visible in this
# terminal.  Ctrl+C interrupts pnpm dev and triggers the cleanup trap above.
#
# --prod:  plasmo dev --tag=prod  →  chrome-mv3-prod  (same dir as initial build)
# local:   plasmo dev             →  chrome-mv3-dev   (same dir as initial build)

if [ "$USE_PROD" = true ]; then
    (cd apps/extension && pnpm exec plasmo dev --tag=prod) 2>&1 | tee -a .extension.log
else
    (cd apps/extension && pnpm dev) 2>&1 | tee -a .extension.log
fi

# Extension dev server exited on its own — clean up everything
cleanup
