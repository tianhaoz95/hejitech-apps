"""Stage `convert` (Apple silicon Mac): quantizes the merged model to MLX 4-bit like
mlx-community/Qwen3-0.6B-4bit, then scores it with the eval (evals/llm) next to the stock Lite,
so the comparison that decides shipping is the 4-bit model the app would actually load."""

import subprocess
import sys

from ..config import EVAL_DIR, PROJECT_DIR

STOCK_LITE = PROJECT_DIR / "VoxbriefApp" / "Resources" / "Models" / "Qwen3-0.6B-4bit"


def run_stage(run, limit=None):
    from mlx_lm import convert

    config = run["convert"]
    out = run.path("mlx")
    if out.exists():
        raise SystemExit(f"convert: {out} already exists; delete it to convert again")
    convert(hf_path=str(run.path("merged")), mlx_path=str(out), quantize=True,
            q_bits=config["q_bits"], q_group_size=config["q_group_size"])
    print(f"convert: MLX {config['q_bits']}-bit model -> {out}")

    if not run.prompts_export.exists():
        print("convert: no prompt export, skipping the eval (see README, 'Prompt export')")
        return
    for name, model in [("finetuned", out), ("stock", STOCK_LITE)]:
        if not model.exists():
            print(f"convert: {model} missing, skipping the {name} eval")
            continue
        command = [sys.executable, str(EVAL_DIR / "run_eval.py"), "--prompts", str(run.prompts_export),
                   "--model", str(model), "--out", str(run.path(f"eval_{name}.json")),
                   "--report", str(run.path(f"eval_{name}.md"))]
        print("convert: " + " ".join(command), flush=True)
        subprocess.run(command, check=True)
    print(f"convert: compare {run.path('eval_finetuned.md')} with {run.path('eval_stock.md')}")
