"""Stage `build`: turns transcribed, blind-agreed utterances into laya.train rows
({state, questions, expected}): the state is what Whisper heard, the questions are the app's
request verbatim, the expected answers are the plan's labels. Utterances close to any eval
utterance (spec/utterances.jsonl) are dropped so the eval stays held out. Writes
dataset/train.jsonl, dataset/val.jsonl and manifest.json."""

import difflib
import hashlib
import json
import re
import subprocess
from collections import Counter

from .. import jsonl
from ..config import PROJECT_DIR, SPEC_DIR
from ..laya import laya_questions, load_export, training_row

HELD_OUT_SIMILARITY = 0.9


def normalize(text):
    return " ".join(re.findall(r"[a-z0-9']+", text.lower()))


def eval_texts():
    rows = [json.loads(line) for line in (SPEC_DIR / "utterances.jsonl").read_text().splitlines() if line.strip()]
    return [normalize(r["text"]) for r in rows]


def near_eval(text, held_out):
    key = normalize(text)
    return any(key == other or difflib.SequenceMatcher(None, key, other).ratio() >= HELD_OUT_SIMILARITY
               for other in held_out)


def in_validation(plan_id, fraction):
    digest = int(hashlib.sha256(plan_id.encode()).hexdigest()[:8], 16)
    return digest / 0xFFFFFFFF < fraction


def _git_commit():
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        # a synced copy without .git (the Spark): the sync writes the commit to GIT_COMMIT at the repo root
        marker = PROJECT_DIR.parent.parent / "GIT_COMMIT"
        return marker.read_text().strip() if marker.exists() else None


def run_stage(run, limit=None):
    questions = laya_questions(load_export(run.laya_export))
    # `include`: earlier runs whose data this one adds to (a top-up run's ids have their own prefix).
    sources = [run.dir] + [run.dir.parent / name for name in run["run"].get("include", [])]
    plans = {p["id"]: p for d in sources for p in jsonl.read(d / "utterances.jsonl")}
    heard = [r for d in sources for r in jsonl.read(d / "asr.jsonl")][:limit]
    held_out = eval_texts()
    train, val, seen, dropped = [], [], set(), Counter()
    for record in heard:
        plan_id, index = record["id"].rsplit("-", 1)
        plan = plans[plan_id]
        said = plan["utterances"][int(index)]["text"]
        state = record["asr"].strip()
        if not state:
            dropped["empty transcript"] += 1
            continue
        if near_eval(said, held_out) or near_eval(state, held_out):
            dropped["close to an eval utterance"] += 1
            continue
        key = (normalize(state), json.dumps(plan["labels"], sort_keys=True))
        if key in seen:
            dropped["duplicate"] += 1
            continue
        seen.add(key)
        row = dict(training_row(state, questions, plan["labels"]), id=record["id"], type=plan["type"])
        (val if in_validation(plan_id, run["run"]["val_fraction"]) else train).append(row)

    dataset = run.path("dataset")
    jsonl.write(dataset / "train.jsonl", train)
    jsonl.write(dataset / "val.jsonl", val)
    utterances = [u for p in plans.values() for u in p["utterances"]]
    manifest = {
        "run": run["run"]["name"],
        "git_commit": _git_commit(),
        "laya_export_sha256": hashlib.sha256(run.laya_export.read_bytes()).hexdigest(),
        "written": len(utterances),
        "blind_agreement": round(sum(u["agrees"] for u in utterances) / max(len(utterances), 1), 3),
        "dropped": dict(dropped),
        "train": {"rows": len(train), "by_type": dict(Counter(r["type"] for r in train))},
        "val": {"rows": len(val), "by_type": dict(Counter(r["type"] for r in val))},
        "config": run.snapshot(),
    }
    run.path("manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"build: {len(train)} train / {len(val)} val rows (dropped {dict(dropped)}) -> {dataset}")
