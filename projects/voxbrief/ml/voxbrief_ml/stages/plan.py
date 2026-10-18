"""Stage `plan`: decides every scenario up front (kind, mode, template, dictionary, which terms
are spoken, persona, topic) from the run's seed, so the mix in the config is exact and a run is
reproducible. No model involved."""

import random

from .. import jsonl

PERSONAS = [
    "a startup founder walking between meetings", "a nurse finishing a night shift",
    "a backend engineer on call", "a product designer reviewing mockups", "a parent of two toddlers",
    "a high-school teacher planning lessons", "a sales rep driving between clients",
    "a freelance photographer", "a PhD student in biology", "a small restaurant owner",
    "an indie iOS developer", "a project manager at an agency", "a real-estate agent",
    "a retiree organizing a community event", "a marketing lead preparing a launch",
    "a general practitioner between patients", "a lawyer drafting a contract", "a data analyst",
    "a construction site manager", "a musician booking a tour", "a recruiter screening candidates",
    "an accountant during tax season", "a university admissions officer", "a support team lead",
]
TOPICS = [
    "a product launch", "a bug in production", "weekly groceries", "a doctor's appointment",
    "a client follow-up", "travel plans", "a team offsite", "hiring for an open role",
    "a home renovation", "the quarterly budget", "a conference talk", "a database migration",
    "a birthday party", "an investor update", "onboarding a new teammate", "a school project",
    "a customer complaint", "an app redesign", "a contract negotiation", "a fitness routine",
    "a security review", "a podcast episode", "moving apartments", "a research experiment",
    "a pricing change", "a vendor invoice", "a wedding", "a sprint retrospective",
]
KINDS = ["correction", "negative_unused", "negative_lookalike", "plain"]


def _pick(rng, weights):
    keys = list(weights)
    return rng.choices(keys, weights=[weights[k] for k in keys])[0]


def _entry(rng, term, config):
    entry = {"term": term["term"]}
    if term.get("aliases") and rng.random() < config["alias_probability"]:
        entry["aliases"] = list(term["aliases"])
    if term.get("hint") and rng.random() < config["hint_probability"]:
        entry["contextHint"] = term["hint"]
    return entry


def plan_scenario(rng, index, run_config, terms):
    kind = _pick(rng, run_config["mix"])
    mode = "light" if rng.random() < run_config["modes"]["light"] else "full"
    scenario = {
        "id": f"s{index:06d}",
        "kind": kind,
        "mode": mode,
        "template": None if mode == "light" else _pick(rng, run_config["templates"]),
        "persona": rng.choice(PERSONAS),
        "topic": rng.choice(TOPICS),
        "dictionary": [],
        "spoken": [],      # terms the speaker says (correction)
        "lookalike": None,  # a common-word term used in its ordinary meaning (negative_lookalike)
    }
    if kind == "plain":
        return scenario

    dictionary_config = run_config["dictionary"]
    size = rng.randint(1, dictionary_config["max_entries"])
    if kind == "negative_lookalike":
        common = [t for t in terms if t.get("common_word")]
        if not common:
            raise ValueError("negative_lookalike needs common_word terms in the term bank")
        lookalike = rng.choice(common)
        others = rng.sample([t for t in terms if t is not lookalike], min(size - 1, len(terms) - 1))
        chosen = [lookalike] + others
        scenario["lookalike"] = lookalike["term"]
    else:
        chosen = rng.sample(terms, min(size, len(terms)))
        if kind == "correction":
            spoken = rng.sample(chosen, min(len(chosen), rng.choice([1, 1, 1, 2, 2, 3])))
            scenario["spoken"] = [t["term"] for t in spoken]
    rng.shuffle(chosen)
    scenario["dictionary"] = [_entry(rng, t, dictionary_config) for t in chosen]
    return scenario


def run_stage(run, limit=None):
    terms = jsonl.read(run.path("terms.jsonl"))
    if not terms:
        raise SystemExit("plan: no terms.jsonl yet; run the `terms` stage first")
    rng = random.Random(run["run"]["seed"])
    count = run["run"]["examples"] if limit is None else min(limit, run["run"]["examples"])
    scenarios = [plan_scenario(rng, i, run.config, terms) for i in range(count)]
    out = run.path("plan.jsonl")
    jsonl.write(out, scenarios)
    by_kind = {k: sum(s["kind"] == k for s in scenarios) for k in KINDS}
    print(f"plan: {len(scenarios)} scenarios {by_kind} -> {out}")
