"""Stage `publish`: uploads the MLX model to the Hugging Face repo in [publish] with a model card
(base model, data recipe, eval numbers) and tags the commit with the run name. Switching the app
to it is a separate, deliberate change (README, 'Shipping a model')."""

import json


def model_card(run):
    manifest = json.loads(run.path("manifest.json").read_text())
    lines = [
        "---", "license: apache-2.0", f"base_model: {run['train']['base_model']}", "library_name: mlx",
        "tags: [mlx, voxbrief, qwen3]", "---", "",
        f"# Voxbrief Lite ({run['run']['name']})", "",
        f"LoRA fine-tune of {run['train']['base_model']}, quantized to MLX {run['convert']['q_bits']}-bit, "
        "for Voxbrief's on-device note writing: template choice, structured JSON notes and light "
        "proofreading, with personal-dictionary terms fixed when speech recognition mishears them.", "",
        "Training data is synthetic: a large teacher model wrote voice memos and ideal notes; the memos "
        "were read by TTS and transcribed by Whisper base.en so inputs carry real recognition errors. "
        "Held-out dictionary terms never appear in training.", "",
        f"- Training examples: {manifest['train']['examples']} ({manifest['train']['by_task']})",
        f"- Source commit: {manifest['git_commit']}", "",
    ]
    for name in ("finetuned", "stock"):
        report = run.path(f"eval_{name}.md")
        if report.exists():
            lines += [f"## Eval: {'this model' if name == 'finetuned' else 'stock Qwen3-0.6B-4bit'}", "",
                      report.read_text().split("\n| Case |")[0].strip(), ""]
    return "\n".join(lines) + "\n"


def run_stage(run, limit=None):
    from huggingface_hub import HfApi

    config = run["publish"]
    if not config["repo"]:
        raise SystemExit("publish: set [publish] repo in the config first")
    folder = run.path("mlx")
    (folder / "README.md").write_text(model_card(run))
    api = HfApi()
    api.create_repo(config["repo"], private=config["private"], exist_ok=True)
    commit = api.upload_folder(repo_id=config["repo"], folder_path=str(folder),
                               commit_message=f"Voxbrief Lite {run['run']['name']}")
    api.create_tag(config["repo"], tag=run["run"]["name"], revision=commit.oid, exist_ok=True)
    print(f"publish: https://huggingface.co/{config['repo']} (tag {run['run']['name']}, commit {commit.oid})")
