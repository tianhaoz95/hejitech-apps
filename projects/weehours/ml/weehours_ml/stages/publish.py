"""Stage `publish`: uploads the GGUFs to the Hugging Face repo in [publish] with a model card
(base model, data recipe, the eval report) and a snapshot of the eval sentences, uploads the run's
data to [publish] dataset_repo (`publish_data`), and tags both commits with the run name. Shipping
it in the app is a separate, deliberate change (README, 'Shipping a model')."""

import json
import shutil

from ..config import SPEC_DIR
from . import publish_data


def model_card(run):
    manifest = json.loads(run.path("manifest.json").read_text())
    eval_md = run.path("eval.md")
    lines = [
        "---", "license: apache-2.0", f"base_model: {run['train']['base_model']}",
        "tags: [gguf, laya, decision-model, wee-hours]", "pipeline_tag: text-classification", "---", "",
        f"# Laya for Wee Hours ({run['run']['name']})", "",
        f"{run['train']['base_model']} fine-tuned with `laya.train` (RLCD) for Wee Hours' voice log: "
        "category × phase and field questions over what a parent said, as the app asks them "
        "(llama.cpp `/v1/systemone`). GGUF converted with llama.cpp "
        f"{run['convert']['llama_cpp_commit']}; the app runs the {run['convert']['quantization']} file.", "",
        "Training data is synthetic: a large teacher model wrote utterances for labels fixed in "
        "advance and kept only those it labelled the same way blind; they were read by TTS and "
        "transcribed by Whisper base.en with the app's prompt, so states carry real recognition "
        "errors. The app's eval utterances were held out.", "",
        f"- Training rows: {manifest['train']['rows']}; blind agreement {manifest['blind_agreement']}",
        f"- Training data: https://huggingface.co/datasets/{run['publish']['dataset_repo']}/tree/{run['run']['name']}",
        "- Eval sentences, as scored: `eval/utterances.jsonl` (the app's `spec/utterances.jsonl` at publish time)",
        f"- Source commit: {manifest['git_commit']}", "",
    ]
    if eval_md.exists():
        lines += ["# Eval (the app's logeval, fine-tuned vs the model the app shipped before)", "", eval_md.read_text()]
    return "\n".join(lines) + "\n"


def run_stage(run, limit=None):
    from huggingface_hub import HfApi

    config = run["publish"]
    if not config["repo"]:
        raise SystemExit("publish: set [publish] repo in the config first")
    folder = run.path("gguf")
    (folder / "README.md").write_text(model_card(run))
    if run.path("calibration.json").exists():
        (folder / "calibration.json").write_text(run.path("calibration.json").read_text())
    (folder / "eval").mkdir(exist_ok=True)
    shutil.copy(SPEC_DIR / "utterances.jsonl", folder / "eval" / "utterances.jsonl")
    publish_data.upload(run)
    api = HfApi()
    api.create_repo(config["repo"], private=config["private"], exist_ok=True)
    commit = api.upload_folder(repo_id=config["repo"], folder_path=str(folder),
                               commit_message=f"Laya for Wee Hours {run['run']['name']}")
    api.create_tag(config["repo"], tag=run["run"]["name"], revision=commit.oid, exist_ok=True)
    print(f"publish: https://huggingface.co/{config['repo']} (tag {run['run']['name']}, commit {commit.oid})")
