#!/usr/bin/env bash
# Runs the decision-layer eval against Laya on llama-server and refits calibration.
#   LLAMA_SERVER_BIN=/path/llama-server LAYA_MODEL=/path/Laya-Q8_0.gguf scripts/eval.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAYA_PORT="${LAYA_PORT:-8089}"
if ! curl -s "http://127.0.0.1:${LAYA_PORT}/health" | grep -q ok; then
  "${LLAMA_SERVER_BIN:-llama-server}" -m "${LAYA_MODEL:?set LAYA_MODEL}" --port "$LAYA_PORT" -ub 2048 -b 2048 >/tmp/llama-server.log 2>&1 &
  trap 'kill %1 2>/dev/null || true' EXIT
  for _ in $(seq 1 60); do curl -s "http://127.0.0.1:${LAYA_PORT}/health" | grep -q ok && break; sleep 1; done
fi
cd "$ROOT/apps/ios/LogCore"
swift build -c release --product logeval
for design in flat hierarchical; do
  .build/release/logeval --model "http://127.0.0.1:${LAYA_PORT}" --design $design --out "$ROOT/eval/results"
  .build/release/logeval --model "http://127.0.0.1:${LAYA_PORT}" --design $design --fit --out "$ROOT/eval/results"
done
.build/release/logeval --model keywords --out "$ROOT/eval/results"
cp "$ROOT/eval/results/laya-hierarchical-calibrated.calibration.json" "$ROOT/spec/calibration.json"
"$ROOT/scripts/sync-spec.sh"
echo "calibration updated: spec/calibration.json"
