"""Stage `train` (DGX Spark): fine-tunes Laya with its authors' own trainer, `laya.train.finetune`
(RLCD: proper-scoring-rule rewards; it also holds out up to 400 items and fits calibration
temperatures). The output is a laya checkpoint directory (`laya.load` layout) in runs/<name>/laya/."""

import json


def run_stage(run, limit=None):
    from laya.train import TrainConfig, finetune, resolve_checkpoint_dir

    config = run["train"]
    base = resolve_checkpoint_dir(config["base_model"])
    data = run.path("dataset/train.jsonl")
    val = run.path("dataset/val.jsonl")
    if limit:
        lines = data.read_text().splitlines()[:limit]
        data = run.path("dataset/train.limited.jsonl")
        data.write_text("\n".join(lines) + "\n")
    out = run.path("laya")
    summary = finetune(str(data), base, str(out), TrainConfig(
        epochs=config["epochs"],
        micro_batch=config["micro_batch"],
        grad_accum=config["grad_accum"],
        encoder_lr=config["encoder_lr"],
        head_lr=config["head_lr"],
        seed=run["run"]["seed"],
        eval_data=str(val) if val.exists() and val.stat().st_size else None,
    ))
    run.path("train_summary.json").write_text(json.dumps(summary, indent=2, default=str) + "\n")
    print(f"train: fine-tuned laya -> {out}")
