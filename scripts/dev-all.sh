#!/bin/bash

# dev-all.sh - Start full local environment and cleanup on exit
# Compatible with macOS and Linux

# Enable job control
set -m

EMULATOR_PID=""
STRIPE_PID=""
EXTENSION_PID=""

cleanup() {
    echo ""
    echo "🛑 Shutting down environment..."
    
    if [ -n "$EMULATOR_PID" ]; then
        echo "Killing Firebase Emulator (PID: $EMULATOR_PID)..."
        kill $EMULATOR_PID 2>/dev/null
    fi
    
    if [ -n "$STRIPE_PID" ]; then
        echo "Killing Stripe Mock (PID: $STRIPE_PID)..."
        kill $STRIPE_PID 2>/dev/null
    fi

    if [ -n "$EXTENSION_PID" ]; then
        echo "Killing Extension Dev (PID: $EXTENSION_PID)..."
        kill $EXTENSION_PID 2>/dev/null
    fi
    
    echo "✅ Cleanup complete."
    exit
}

# Trap signals
trap cleanup SIGINT SIGTERM

echo "🚀 Initializing Icecap Local Environment..."

# Initial cleanup to ensure ports are free
echo "🧹 Cleaning up existing processes on emulator and mock ports..."
PIDS=$(lsof -ti:4000,9099,8080,5001,5002,12111 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
fi

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

echo "🌱 Seeding emulator data..."
pnpm run emulator:seed
sleep 2

echo "🌍 Opening Firebase Emulator UI..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://127.0.0.1:4000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open http://127.0.0.1:4000 2>/dev/null || echo "Please open http://127.0.0.1:4000 manually"
fi

echo "🚀 Starting application dev servers..."
# Start extension in background (it often has FSEvents issues on some systems)
pnpm --filter @icecap/extension dev > .extension.log 2>&1 &
EXTENSION_PID=$!
echo "✅ Extension backgrounded (PID: $EXTENSION_PID). Logs: .extension.log"

# Start the rest of the apps (Hub, Admin, Landing, etc.)
pnpm turbo run dev --parallel --filter=!@icecap/extension --filter=!@icecap/stripe-mock

# If pnpm dev finishes naturally (rare for a watcher), cleanup
cleanup
