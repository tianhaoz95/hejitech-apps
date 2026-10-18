"""Stage `build`: turns filtered targets into prompt/completion training examples in the app's
exact prompt format (the Stage 2 calls Lite makes on device), split into train and validation by
scenario, plus a manifest describing the dataset.

- full notes -> a classification example (the app's template-picking call) and a generation
  example for the planned template;
- light -> one proofreading example.
"""

import hashlib
import json
import subprocess
from collections import Counter

from .. import jsonl
from ..app_prompts import load_kit
from ..checks import extract_json


def examples_for(scenario, record, kit):
    dictionary = scenario["dictionary"]
    heard = record["input"]
    target = json.dumps(extract_json(record["target"]), ensure_ascii=False)
    meta = {"scenario": scenario["id"], "kind": scenario["kind"], "mode": scenario["mode"],
            "template": scenario["template"], "misheard": record.get("misheard", [])}
    if scenario["mode"] == "light":
        return [{"task": "light", "prompt": [
            {"role": "system", "content": kit.light_system(dictionary)},
            {"role": "user", "content": kit.user_prompt(heard, dictionary)},
        ], "completion": target, "meta": meta}]
    template = scenario["template"]
    return [
        {"task": "classify", "prompt": [
            {"role": "system", "content": kit.classification_system()},
            {"role": "user", "content": heard},  # the app classifies the bare transcript
        ], "completion": json.dumps({"template": template}), "meta": meta},
        {"task": "generate", "prompt": [
            {"role": "system", "content": kit.generation_system(template, dictionary)},
            {"role": "user", "content": kit.user_prompt(heard, dictionary)},
        ], "completion": target, "meta": meta},
    ]


def in_validation(scenario_id, fraction):
    digest = int(hashlib.sha256(scenario_id.encode()).hexdigest()[:8], 16)
    return digest / 0xFFFFFFFF < fraction


def _git_commit():
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def run_stage(run, limit=None):
    kit = load_kit(run.prompts_export)
    scenarios = {s["id"]: s for s in jsonl.read(run.path("scenarios.jsonl"))}
    filtered = jsonl.read(run.path("filtered.jsonl"))[:limit]
    train, val = [], []
    for record in filtered:
        scenario = scenarios[record["id"]]
        split = val if in_validation(scenario["id"], run["run"]["val_fraction"]) else train
        split.extend(examples_for(scenario, record, kit))
    dataset = run.path("dataset")
    jsonl.write(dataset / "train.jsonl", train)
    jsonl.write(dataset / "val.jsonl", val)

    def counts(examples):
        return {"examples": len(examples),
                "by_task": dict(Counter(e["task"] for e in examples)),
                "by_kind": dict(Counter(e["meta"]["kind"] for e in examples if e["task"] != "classify")),
                "by_template": dict(Counter(e["meta"]["template"] for e in examples if e["task"] == "generate")),
                "with_mishearing": sum(bool(e["meta"]["misheard"]) for e in examples if e["task"] != "classify")}

    stats_path = run.path("filter_stats.json")
    manifest = {
        "run": run["run"]["name"],
        "git_commit": _git_commit(),
        "prompts_export_sha256": hashlib.sha256(run.prompts_export.read_bytes()).hexdigest(),
        "train": counts(train),
        "val": counts(val),
        "filter": json.loads(stats_path.read_text()) if stats_path.exists() else None,
        "config": run.snapshot(),
    }
    run.path("manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"build: {len(train)} train / {len(val)} val examples -> {dataset}")
