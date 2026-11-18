#!/usr/bin/env bash
# Streams recorded stories (16 kHz WAVs named <story>_<voice>.wav) through the Roarly app on the
# attached iPhone (real on-device SpeechAnalyzer via -listenFile, no mic prompt) and scores what
# played against evals/stories/key.json. The installed app must be a Debug build.
# Usage: scripts/device_story_eval.sh <device-udid> <wav>... [-- extra launch flags]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV="$1"; shift
FILES=(); EXTRA=()
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--" ]]; then shift; EXTRA=("$@"); break; fi
  FILES+=("$1"); shift
done
LOGS="$ROOT/build/story_eval"; mkdir -p "$LOGS"
for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  secs=$(python3 -c "import wave,sys; w=wave.open(sys.argv[1]); print(int(w.getnframes()/w.getframerate())+12)" "$f")
  xcrun devicectl device copy to --device "$DEV" --domain-type appDataContainer --domain-identifier com.hejitech.roarly --source "$f" --destination "Documents/$name" >/dev/null
  timeout "$secs" xcrun devicectl device process launch --device "$DEV" --terminate-existing --console com.hejitech.roarly -- -skipOnboarding -proUnlocked -mode play -listenFile "$name" -autoListen ${EXTRA[@]+"${EXTRA[@]}"} > "$LOGS/${name%.wav}.log" 2>&1 || true
  python3 - "$ROOT/evals/stories/key.json" "$LOGS/${name%.wav}.log" "$name" <<'PY'
import json, re, sys
key = json.load(open(sys.argv[1])); log = open(sys.argv[2], errors="ignore").read(); name = sys.argv[3]
k = key[name.split("_")[0]]
played = set(re.findall(r"▶︎ (\w+)", log)) | set(re.findall(r"∿ start (\w+)", log))
stopped = set(re.findall(r"∿ stop (\w+)", log))
heard = re.findall(r"heard: (.*)", log)
miss = [c for c in k["play"] if c not in played]
wrong = [c for c in k.get("never", []) if c in played]
nostop = [c for c in k.get("stop", []) if c not in stopped]
ok = len(k["play"]) - len(miss) + len(k.get("never", [])) - len(wrong)
tot = len(k["play"]) + len(k.get("never", []))
print(f"{name}: {ok}/{tot}  missed={miss} wrongly played={wrong} not stopped={nostop}  ({len(heard)} lines heard)")
PY
done
