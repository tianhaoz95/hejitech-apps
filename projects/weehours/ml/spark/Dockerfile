# Image for the stages that need CUDA (tts, asr, train, convert): NGC vLLM (its CUDA PyTorch, aarch64) + deps.
# docker build -t heji-ml spark
FROM nvcr.io/nvidia/vllm:26.09-py3
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng && rm -rf /var/lib/apt/lists/*
# The container pins its own torch through PIP_CONSTRAINT; keep it.
RUN pip install --no-cache-dir "kokoro>=0.9.4" soundfile scipy "transformers>=4.51" "laya>=0.4" "openai>=1.40" "huggingface_hub>=0.30" pytest
RUN python -c "import kokoro, laya, transformers, torch; print(torch.__version__, transformers.__version__)"
# misaki (Kokoro's English G2P) loads this spaCy model and would otherwise pip-install it at run time.
RUN python -m spacy download en_core_web_sm
