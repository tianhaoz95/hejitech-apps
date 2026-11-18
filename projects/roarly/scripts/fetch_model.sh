#!/usr/bin/env bash
# Puts the bundled small model (mlx-community/Qwen3-0.6B-4bit, ~335 MB, git-ignored) where the
# Xcode project expects it. Idempotent. CI caches the folder.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/apps/ios/App/Resources/Models/Qwen3-0.6B-4bit"
if [[ -f "$DIR/model.safetensors" && -f "$DIR/tokenizer.json" ]]; then
  echo "model already in place: $DIR"; exit 0
fi
mkdir -p "$DIR"
if ! command -v hf >/dev/null 2>&1; then
  python3 -m pip install --quiet --user -U huggingface_hub 2>/dev/null || python3 -m pip install --break-system-packages --quiet -U huggingface_hub
fi
hf download mlx-community/Qwen3-0.6B-4bit --local-dir "$DIR"
rm -rf "$DIR/.cache"
echo "model ready: $DIR"
