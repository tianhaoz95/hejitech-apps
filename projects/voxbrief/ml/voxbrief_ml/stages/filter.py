"""Stage `filter`: keeps only targets that pass the eval's own checks (evals/llm/checks.py) plus
data-specific ones, and drops duplicate memos. Rejections go to rejected.jsonl with reasons, to
read before trusting a run."""

import difflib
import json
import re
from collections import Counter

from .. import jsonl
from ..app_prompts import load_kit
from ..checks import extract_json, score_output

FILLERS = {"um", "uh", "erm", "hmm"}


def _words(text):
    return [w for w in re.findall(r"[a-z0-9']+", text.lower()) if w not in FILLERS]


def light_similarity(cleaned, said):
    """How much of what was said the light cleanup kept (word sequence similarity, 0-1)."""
    return difflib.SequenceMatcher(None, _words(cleaned), _words(said)).ratio()


def expectations(scenario):
    """The eval-style `expect` block this scenario's target must meet."""
    expect = {}
    spoken = set(scenario["spoken"])
    unspoken = [e["term"] for e in scenario["dictionary"] if e["term"] not in spoken and e["term"] != scenario["lookalike"]]
    if spoken:
        expect["contains"] = sorted(spoken)
    if unspoken:
        expect["not_contains_ci"] = unspoken
    if scenario["lookalike"]:
        expect["body_not_contains"] = [scenario["lookalike"]]
    if scenario["mode"] == "full":
        expect["template"] = scenario["template"]
    else:
        expect["not_words_ci"] = sorted(FILLERS)
    return expect


def check(scenario, record, kit, min_light_similarity):
    """Names of the failed checks (empty when the example is good)."""
    if scenario["mode"] == "full":
        field_keys = kit.field_keys(scenario["template"])
        template = (record.get("teacher_template") or "").strip()
        template = next((t for t in kit.templates if t.lower() == template.lower()), template)
    else:
        field_keys, template = [], None
    failures = [name for name, ok, _ in score_output(record["target"], scenario["mode"], field_keys,
                                                     expectations(scenario), template) if not ok]
    if scenario["mode"] == "light" and not failures:
        cleaned = extract_json(record["target"]).get("cleanedText", "")
        if light_similarity(cleaned, scenario["transcript"]) < min_light_similarity:
            failures.append("light keeps content")
    return failures


def misheard(scenario, heard):
    """Spoken terms the transcript Lite receives doesn't spell right (the cases that teach correction)."""
    return [t for t in scenario["spoken"] if t not in heard]


def run_stage(run, limit=None):
    kit = load_kit(run.prompts_export)
    scenarios = {s["id"]: s for s in jsonl.read(run.path("scenarios.jsonl"))}
    targets = jsonl.read(run.path("targets.jsonl"))[:limit]
    kept, rejected, reasons, seen = [], [], Counter(), set()
    for record in targets:
        scenario = scenarios[record["id"]]
        key = " ".join(_words(scenario["transcript"]))
        failures = ["duplicate memo"] if key in seen else check(scenario, record, kit, run["filter"]["min_light_similarity"])
        if failures:
            reasons.update(failures)
            rejected.append({"id": record["id"], "failures": failures, "input": record["input"],
                             "said": scenario["transcript"], "target": record["target"]})
            continue
        seen.add(key)
        kept.append(dict(record, misheard=misheard(scenario, record["input"])))
    jsonl.write(run.path("filtered.jsonl"), kept)
    jsonl.write(run.path("rejected.jsonl"), rejected)
    stats = {"targets": len(targets), "kept": len(kept), "rejected": len(rejected),
             "reasons": dict(reasons.most_common()),
             "corrections_with_mishearing": sum(bool(r["misheard"]) for r in kept)}
    run.path("filter_stats.json").write_text(json.dumps(stats, indent=2) + "\n")
    print(f"filter: kept {len(kept)}/{len(targets)}; top reasons {dict(reasons.most_common(5))}")
