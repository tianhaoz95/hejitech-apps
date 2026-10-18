#!/bin/bash
# Pilot, then the full run, unattended on the Spark: spark/all.sh (log: tee it somewhere)
# The pilot's data must pass a sanity gate (blind agreement, row count) before the full run
# spends hours of teacher time; convert ends it, then `evaluate` runs on a Mac (README).
set -euo pipefail
ML=$(cd "$(dirname "$0")/.." && pwd)
RUN="$ML/spark/run.sh"
cd "$ML"

docker build -t heji-ml spark
"$RUN" configs/pilot.toml teacher-up
"$RUN" configs/pilot.toml verify plan utterances tts asr build
python3 - runs/pilot/manifest.json <<'EOF'
import json, sys
m = json.load(open(sys.argv[1]))
print(json.dumps({k: m[k] for k in ("written", "blind_agreement", "dropped", "train", "val")}, indent=1))
if m["blind_agreement"] < 0.5 or m["train"]["rows"] < 200:
    sys.exit("pilot gate failed: look at runs/pilot before the full run")
EOF
"$RUN" configs/full.toml plan utterances teacher-down tts asr build train convert
