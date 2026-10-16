#!/usr/bin/env bash
# Builds apps/ios/Vendor/llama.xcframework (iOS device, iOS simulator, macOS) from a pinned llama.cpp
# commit that has the Laya decision-model architecture. ~10 minutes; CI caches the result.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LLAMA_COMMIT="${LLAMA_COMMIT:-e467e5b}"
WORK="${LLAMA_WORK:-$ROOT/.llama-build}"
OUT="$ROOT/apps/ios/Vendor/llama.xcframework"

if [[ -d "$OUT" && "${FORCE:-}" != "1" ]]; then echo "exists: $OUT (FORCE=1 to rebuild)"; exit 0; fi
if [[ ! -d "$WORK/.git" ]]; then
  git clone --filter=blob:none https://github.com/ggml-org/llama.cpp.git "$WORK"
fi
cd "$WORK"
git fetch --depth 1 origin "$LLAMA_COMMIT" 2>/dev/null || git fetch origin
git checkout -q "$LLAMA_COMMIT"
./build-xcframework.sh ios-sim ios-device macos
mkdir -p "$ROOT/apps/ios/Vendor"
rm -rf "$OUT"
rsync -a --exclude dSYMs build-apple/llama.xcframework "$ROOT/apps/ios/Vendor/"
# the dSYMs are not shipped; drop their references so SwiftPM accepts the framework
python3 - "$OUT/Info.plist" <<'PY'
import plistlib, sys
p = sys.argv[1]
d = plistlib.load(open(p, "rb"))
for lib in d["AvailableLibraries"]:
    lib.pop("DebugSymbolsPath", None)
plistlib.dump(d, open(p, "wb"))
PY
echo "built $OUT"
