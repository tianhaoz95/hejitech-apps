"""Stage `plan`: decides every labelled plan up front (event type, field values, how the time is
said, whether the child is named) from the run's seed, so the mix is exact and reproducible.
The labels are fixed here; the teacher only has to say them naturally."""

import random

from .. import jsonl
from ..laya import NONE, Registry


def _pick(rng, weights):
    keys = list(weights)
    return rng.choices(keys, weights=[weights[k] for k in keys])[0]


def plan_one(rng, index, config, registry):
    type_id = _pick(rng, config["types"])
    fields = {}
    for q in registry.field_questions(type_id):
        keys = list(registry.questions[q]["options"])
        stated = [k for k in keys if k != "not_stated"]
        if "not_stated" in keys and rng.random() < config["fields"]["not_stated"]:
            fields[q] = "not_stated"
        else:
            fields[q] = rng.choice(stated)
    children = config["children"]
    return {
        "id": f"{config['run'].get('id_prefix', 'p')}{index:06d}",
        "type": type_id,
        "fields": fields,
        "labels": registry.labels(type_id, fields),
        "when": "now" if type_id == NONE else _pick(rng, config["when"]),
        "child": rng.choice(children["names"]) if rng.random() < children["probability"] else None,
    }


def run_stage(run, limit=None):
    registry = Registry()
    rng = random.Random(run["run"]["seed"])
    count = run["run"]["plans"] if limit is None else min(limit, run["run"]["plans"])
    plans = [plan_one(rng, i, run.config, registry) for i in range(count)]
    out = run.path("plan.jsonl")
    jsonl.write(out, plans)
    by_type = {}
    for p in plans:
        by_type[p["type"]] = by_type.get(p["type"], 0) + 1
    print(f"plan: {len(plans)} plans {by_type} -> {out}")
