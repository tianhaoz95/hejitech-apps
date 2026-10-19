"""Stage `publish_data`: uploads a run's text data to the Hugging Face dataset repo in
[publish] dataset_repo, under <run name>/, and tags the commit with the run name. `publish` calls
it too, so a model's tag in the model repo and the data's tag in the dataset repo match. Audio is
left out: `tts` regenerates it from utterances.jsonl, and the training rows already carry what
Whisper heard. `fetch` downloads it back (a top-up's `include`)."""

import json

# what `build` needs from an included run (utterances, asr), plus what explains and reproduces it
FILES = ["plan.jsonl", "utterances.jsonl", "tts.jsonl", "asr.jsonl", "manifest.json", "train_summary.json",
         "dataset/train.jsonl", "dataset/val.jsonl"]

CARD = """---
license: apache-2.0
language: [en]
tags: [synthetic, baby-tracking, laya, wee-hours]
pretty_name: Wee Hours baby activity (synthetic voice-log training data)
task_categories: [text-classification]
---

# Wee Hours baby activity: training data

Synthetic training data for [{model}](https://huggingface.co/{model}), the decision model behind
[Wee Hours](https://github.com/tianhaoz95/hejitech-apps/tree/main/projects/weehours)' on-device
voice log. Made by the app's `ml/` pipeline; nothing here comes from real users.

How it's made: each entry's labels are fixed first (type, field values, how the time is said);
a teacher model (gpt-oss-120b) writes a few things a tired parent would say for it, then labels
each one blind with the app's questions, and only sentences whose blind labels match survive.
Kokoro TTS reads them aloud (varied voices, speeds, night-room noise) and Whisper base.en
transcribes them with the app's prompt, so the training states carry real recognition errors.
The app's own eval sentences (`spec/utterances.jsonl`) are held out.

## Layout

One folder per pipeline run, tagged with the run's name (the model repo uses the same tags):

| File | What |
|---|---|
| `<run>/plan.jsonl` | the labels fixed in advance |
| `<run>/utterances.jsonl` | the teacher's sentences that passed the blind check |
| `<run>/tts.jsonl`, `<run>/asr.jsonl` | the voice each was read with, and what Whisper heard |
| `<run>/dataset/train.jsonl`, `val.jsonl` | `laya.train` rows: `{{state, questions, expected}}`, the app's request verbatim. A top-up's rows include the runs it builds on, so this is the model's whole training set. |
| `<run>/manifest.json`, `train_summary.json` | counts, blind agreement, source commit; training losses and calibration |

Runs: {runs}. Licences: the teacher's outputs (gpt-oss, Apache-2.0) and Kokoro (Apache-2.0)
allow this use.
"""


def runs_in(api, repo):
    return sorted({f.split("/")[0] for f in api.list_repo_files(repo, repo_type="dataset") if "/" in f})


def upload(run):
    """Uploads this run's data; returns the dataset repo's commit id."""
    from huggingface_hub import CommitOperationAdd, HfApi

    config = run["publish"]
    repo, name = config.get("dataset_repo"), run["run"]["name"]
    if not repo:
        raise SystemExit("publish_data: set [publish] dataset_repo in the config first")
    files = [f for f in FILES if run.path(f).exists()]
    # a datagen run has its sentences and transcripts; a train-only run (all `include`) its rows
    if not ({"utterances.jsonl", "asr.jsonl"} <= set(files) or {"dataset/train.jsonl", "manifest.json"} <= set(files)):
        raise SystemExit(f"publish_data: {name} has neither utterances + asr nor a built dataset; run datagen or build first")
    api = HfApi()
    api.create_repo(repo, repo_type="dataset", private=config["private"], exist_ok=True)
    runs = sorted(set(runs_in(api, repo)) | {name})
    card = CARD.format(model=config["repo"], runs=", ".join(f"`{r}`" for r in runs))
    ops = [CommitOperationAdd(f"{name}/{f}", str(run.path(f))) for f in files]
    ops.append(CommitOperationAdd("README.md", card.encode()))
    commit = api.create_commit(repo, repo_type="dataset", operations=ops, commit_message=f"Wee Hours data: {name}")
    api.create_tag(repo, repo_type="dataset", tag=name, revision=commit.oid, exist_ok=True)
    manifest = json.loads(run.path("manifest.json").read_text()) if run.path("manifest.json").exists() else {}
    print(f"publish_data: https://huggingface.co/datasets/{repo}/tree/{name} ({len(files)} files, "
          f"{manifest.get('train', {}).get('rows', '?')} training rows; commit {commit.oid})")
    return commit.oid


def run_stage(run, limit=None):
    upload(run)
