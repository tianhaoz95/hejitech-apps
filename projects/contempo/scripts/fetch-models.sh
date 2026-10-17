#!/usr/bin/env bash
# Downloads the bundled on-device model (Qwen3-0.6B no-think Q4 for LiteRT-LM, ~347MB; runs on LiteRT-LM 0.14) into both apps:
#   android/qwen_model/src/main/assets/Qwen3-0.6B.litertlm   (install-time asset pack)
#   ios/Contempo/Resources/Models/Qwen3-0.6B.litertlm        (app bundle resource)
# Too big for git (GitHub's 100MB limit), so builds fetch it; skips files already present.
set -euo pipefail
cd "$(dirname "$0")/.."
URL="https://huggingface.co/litert-community/Qwen3-0.6B-int4/resolve/main/qwen3_0.6b_nothink_q4_block32_ekv1280.litertlm"
NAME="Qwen3-0.6B.litertlm"
for dir in android/qwen_model/src/main/assets ios/Contempo/Resources/Models; do
  mkdir -p "$dir"
  if [ -s "$dir/$NAME" ]; then echo "  have $dir/$NAME"; continue; fi
  if [ -n "${first:-}" ] && [ -s "$first" ]; then cp "$first" "$dir/$NAME"; else
    echo "  downloading ${NAME}…"
    curl -fsSL --retry 3 -o "$dir/$NAME.part" "$URL" && mv "$dir/$NAME.part" "$dir/$NAME"
  fi
  first="$dir/$NAME"
done
