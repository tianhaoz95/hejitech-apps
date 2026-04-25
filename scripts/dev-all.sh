#!/bin/bash

# dev-all.sh - Start full local environment and cleanup on exit
# Compatible with macOS and Linux

# Enable job control
set -m

EMULATOR_PID=""
STRIPE_PID=""

cleanup() {
    echo ""
    echo "🛑 Shutting down environment..."
    
    if [ -n "$EMULATOR_PID" ]; then
        echo "Killing Firebase Emulator (PID: $EMULATOR_PID)..."
        kill $EMULATOR_PID 2>/dev/null
        # Give it a second to clean up its children
        sleep 1
    fi
    
    if [ -n "$STRIPE_PID" ]; then
        echo "Killing Stripe Mock (PID: $STRIPE_PID)..."
        kill $STRIPE_PID 2>/dev/null
    fi
    
    echo "✅ Cleanup complete."
    exit
}

# Trap signals
trap cleanup SIGINT SIGTERM

echo "🚀 Initializing Icecap Local Environment..."

# Initial cleanup to ensure ports are free
echo "🧹 Cleaning up existing processes on emulator ports..."
lsof -ti:4000,9099,8080,5001,5002 | xargs kill -9 2>/dev/null || true

# Start Firebase Emulator
echo "Starting Firebase Emulator..."
pnpm run emulator > .emulator.log 2>&1 &
EMULATOR_PID=$!
echo "✅ Emulator backgrounded (PID: $EMULATOR_PID). Logs: .emulator.log"

# Start Stripe Mock
echo "Starting Stripe Mock..."
pnpm run dev:stripe-mock > .stripe-mock.log 2>&1 &
STRIPE_PID=$!
echo "✅ Stripe Mock backgrounded (PID: $STRIPE_PID). Logs: .stripe-mock.log"

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

echo "🚀 Starting application dev servers (Turborepo)..."
pnpm run dev

# If pnpm dev finishes naturally (rare for a watcher), cleanup
cleanup
