#!/bin/bash
# Runs pipeline steps on the DGX Spark: spark/run.sh <config> <step...>
#   teacher-up | teacher-down   vLLM serving the teacher (nvcr.io vLLM image), on localhost:8000
#   plan | utterances | build | verify   host Python (BULK_PY, needs `openai` for utterances)
#   anything else (tts, asr, train, convert)   inside the heji-ml image (spark/Dockerfile)
# Bulky data goes to $BULK: the Hugging Face cache, and runs/ when it's a symlink there.
set -euo pipefail
ML=$(cd "$(dirname "$0")/.." && pwd)
BULK=${BULK:-/mnt/AIML/heji-remote-dev}
HOST_PY=${HOST_PY:-$HOME/heji-remote-dev/tools/bin/python}
VLLM_IMAGE=${VLLM_IMAGE:-nvcr.io/nvidia/vllm:26.09-py3}
TEACHER=${TEACHER:-openai/gpt-oss-120b}
CFG=$1; shift
cd "$ML"
for step in "$@"; do
  echo "=== $(date +%H:%M:%S) $step"
  case $step in
    teacher-up)
      docker rm -f teacher >/dev/null 2>&1 || true
      docker run -d --name teacher --gpus all --ipc=host -p 127.0.0.1:8000:8000 \
        -v "$BULK/hf:/root/.cache/huggingface" -e HF_HUB_OFFLINE=1 "$VLLM_IMAGE" \
        vllm serve "$TEACHER" --gpu-memory-utilization 0.75 --max-model-len 8192 --max-num-seqs 160
      until curl -sf localhost:8000/v1/models >/dev/null; do
        docker inspect -f "{{.State.Running}}" teacher | grep -q true || { docker logs --tail 50 teacher; exit 1; }
        sleep 10
      done ;;
    teacher-down) docker rm -f teacher ;;
    plan|utterances|build|verify) "$HOST_PY" -m weehours_ml "$step" --config "$CFG" ;;
    *)
      # Same paths inside as out, so the runs/ symlink and the checkout resolve unchanged.
      docker run --rm --gpus all --ipc=host -u "$(id -u):$(id -g)" -e HOME=/tmp/home -e HF_HOME="$BULK/hf" \
        -v "$HOME:$HOME" -v "$BULK:$BULK" -w "$ML" heji-ml \
        python -m weehours_ml "$step" --config "$CFG" ;;
  esac
done
