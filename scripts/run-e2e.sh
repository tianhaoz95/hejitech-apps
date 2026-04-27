#!/bin/bash

# scripts/run-e2e.sh - Run all E2E integration tests in a clean environment
# This script starts the Firebase Emulator and Stripe Mock, runs Playwright, and cleans up.

# Exit on any error
set -e

# Setup environment for local testing
export PLASMO_PUBLIC_USE_EMULATOR=true
export VITE_USE_EMULATOR=true
export STRIPE_USE_MOCK=true

# Cleanup function to ensure no processes are left hanging
cleanup() {
    echo ""
    echo "🧹 Cleaning up background processes..."
    
    # Kill the processes we started
    [ -n "$EMULATOR_PID" ] && kill "$EMULATOR_PID" 2>/dev/null || true
    [ -n "$STRIPE_PID" ] && kill "$STRIPE_PID" 2>/dev/null || true
    
    # Kill any remaining port-bound processes just in case
    PIDS=$(lsof -ti:4000,9099,8080,5001,5002,12111,5173 2>/dev/null)
    [ -n "$PIDS" ] && echo "$PIDS" | xargs kill -9 2>/dev/null || true
    
    echo "✅ Done."
}

# Trap signals for cleanup
trap cleanup EXIT SIGINT SIGTERM

echo "🚀 Starting E2E Test Environment..."

# 1. Free up ports
echo "Checking ports..."
# Use || true to prevent set -e from exiting if no processes found
PIDS=$(lsof -ti:4000,9099,8080,5001,5002,12111,5173 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo "Freeing busy ports..."
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi

# Ensure Java is in PATH (Homebrew location)
if [[ "$OSTYPE" == "darwin"* ]]; then
    export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
fi

# Create per-run env overrides (same as dev-all.sh)
for app in extension hub admin; do
    printf 'PLASMO_PUBLIC_USE_EMULATOR=true\nVITE_USE_EMULATOR=true\n' > "apps/$app/.env.local"
done

# 2. Build Extension (Required for tests)
echo "Building Extension..."
pnpm --filter @icecap/extension build:prod

# 3. Start Firebase Emulator
echo "Starting Firebase Emulator..."
# Use --non-interactive and redirect logs
pnpm run emulator > .emulator-e2e.log 2>&1 &
EMULATOR_PID=$!

# 3. Start Stripe Mock
echo "Starting Stripe Mock..."
pnpm run dev:stripe-mock > .stripe-mock-e2e.log 2>&1 &
STRIPE_PID=$!

# 5. Wait for Emulator readiness
echo "Waiting for Emulator to be ready (max 30s)..."
count=0
# Wait for Emulator UI (4000), Auth (9099), and Firestore (8080)
while ! curl -s http://127.0.0.1:4000 > /dev/null || ! curl -s http://127.0.0.1:9099 > /dev/null || ! curl -s http://127.0.0.1:8080 > /dev/null; do
    sleep 2
    count=$((count + 1))
    if [ $count -gt 15 ]; then
        echo "❌ Emulator failed to start in time. Check .emulator-e2e.log"
        exit 1
    fi
done
echo "✅ Emulator is UP (UI, Auth, Firestore ready)."

# 5. Run Playwright Tests
echo "🏃 Running Playwright E2E tests..."
# We use pnpm to run the tests in the tests package
# Playwright will automatically start the Hub dev server as defined in playwright.config.ts
pnpm --filter @icecap/tests test
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 All E2E tests passed!"
else
    echo "❌ Some E2E tests failed."
fi

# The cleanup trap will handle killing the background processes
exit $TEST_EXIT_CODE
