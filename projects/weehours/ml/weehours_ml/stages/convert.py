"""Stage `convert`: the fine-tuned laya checkpoint → GGUF, exactly as ggml-org converted the
published Laya-GGUF (`convert_hf_to_gguf.py --outtype bf16`, then `llama-quantize … Q8_0`), with
llama.cpp at the commit the app builds (`[convert] llama_cpp_commit`). The checkpoint's fitted
calibration temperatures travel into the GGUF metadata (`modern-bert.decision.temperature.*`).
Also builds llama-server, which `evaluate` uses."""

import os
import shutil
import subprocess
import sys

from ..config import ML_DIR

BINARIES = ["llama-quantize", "llama-server"]


def llama_cpp(commit):
    """A llama.cpp checkout at `commit` with the binaries built, shared by every run."""
    work = ML_DIR / "runs" / f"llama.cpp-{commit}"
    if not (work / ".git").exists():
        subprocess.run(["git", "clone", "--filter=blob:none", "https://github.com/ggml-org/llama.cpp.git", str(work)], check=True)
    subprocess.run(["git", "-C", str(work), "fetch", "--depth", "1", "origin", commit], check=False)
    subprocess.run(["git", "-C", str(work), "checkout", "-q", commit], check=True)
    build = work / "build"
    if not all((build / "bin" / b).exists() for b in BINARIES):
        subprocess.run(["cmake", "-S", str(work), "-B", str(build), "-DCMAKE_BUILD_TYPE=Release", "-DLLAMA_CURL=OFF"], check=True)
        subprocess.run(["cmake", "--build", str(build), "-j", "--target", *BINARIES], check=True)
    return work


def run_stage(run, limit=None):
    config = run["convert"]
    work = llama_cpp(config["llama_cpp_commit"])
    checkpoint = run.path("laya")
    if not (checkpoint / "rl_agent_config.json").exists():
        raise SystemExit(f"convert: {checkpoint} is not a laya checkpoint; run `train` first")
    # The Hub repo's root config.json ("model_type": "laya") isn't part of laya.load's layout but
    # is what the converter saw for the published GGUF; bring it along when train didn't write it.
    if not (checkpoint / "config.json").exists():
        from huggingface_hub import hf_hub_download

        shutil.copy(hf_hub_download(run["train"]["base_model"], "config.json"), checkpoint / "config.json")

    out = run.path("gguf")
    out.mkdir(exist_ok=True)
    bf16, quantized = out / "Laya-ft-BF16.gguf", out / f"Laya-ft-{config['quantization']}.gguf"
    env_path = str(work / "gguf-py")
    subprocess.run([sys.executable, str(work / "convert_hf_to_gguf.py"), str(checkpoint), "--outtype", "bf16",
                    "--outfile", str(bf16), "--model-name", f"Laya Wee Hours {run['run']['name']}"],
                   check=True, env={**os.environ, "PYTHONPATH": env_path})
    subprocess.run([str(work / "build" / "bin" / "llama-quantize"), str(bf16), str(quantized), config["quantization"]], check=True)
    print(f"convert: {quantized} (and {bf16.name})")
