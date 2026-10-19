#!/usr/bin/env bash
# Fetches the on-device models into apps/ios/App/Models (git-ignored), which the app bundles so voice
# works right after install, offline, with no download step:
#   Laya-Q8_0.gguf                         decision model (~450 MB)
#   whisper/openai_whisper-base.en/        WhisperKit Core ML speech model (~150 MB)
#   whisper/tokenizer/                     its tokenizer
# Builds without these still work: the app falls back to downloading them.
# LAYA_MODEL=/path/Laya-Q8_0.gguf reuses a local copy instead of downloading.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/apps/ios/App/Models"
HF="https://huggingface.co"
source "$ROOT/eval/laya.env"   # LAYA_REPO, LAYA_FILE, LAYA_REVISION: the Laya model in use
mkdir -p "$OUT/whisper/tokenizer"

if [[ ! -s "$OUT/Laya-Q8_0.gguf" ]]; then
  if [[ -n "${LAYA_MODEL:-}" ]]; then
    cp "$LAYA_MODEL" "$OUT/Laya-Q8_0.gguf"
  else
    echo "Downloading Laya-Q8_0.gguf…"
    curl -fL --progress-bar -o "$OUT/Laya-Q8_0.gguf.part" "$HF/$LAYA_REPO/resolve/${LAYA_REVISION:-main}/$LAYA_FILE"
    mv "$OUT/Laya-Q8_0.gguf.part" "$OUT/Laya-Q8_0.gguf"
  fi
fi

WHISPER="openai_whisper-base.en"
if [[ ! -f "$OUT/whisper/$WHISPER/.complete" ]]; then
  echo "Downloading WhisperKit ${WHISPER}…"
  curl -fsSL "$HF/api/models/argmaxinc/whisperkit-coreml/tree/main/$WHISPER?recursive=true" |
    python3 -c 'import json,sys; [print(x["path"]) for x in json.load(sys.stdin) if x["type"] == "file"]' |
    while read -r path; do
      mkdir -p "$OUT/whisper/$(dirname "$path")"
      curl -fsSL -o "$OUT/whisper/$path" "$HF/argmaxinc/whisperkit-coreml/resolve/main/$path"
    done
  touch "$OUT/whisper/$WHISPER/.complete"
fi
for f in tokenizer.json tokenizer_config.json; do
  [[ -s "$OUT/whisper/tokenizer/$f" ]] || curl -fsSL -o "$OUT/whisper/tokenizer/$f" "$HF/openai/whisper-base.en/resolve/main/$f"
done

du -sh "$OUT" | sed 's/^/bundled models: /'
