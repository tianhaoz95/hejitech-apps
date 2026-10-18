import random

from voxbrief_ml import jsonl
from voxbrief_ml.config import TERMS_DIR
from voxbrief_ml.stages.plan import KINDS, plan_scenario
from voxbrief_ml.stages.terms import clean_entry, heldout_terms, leaks, merge_terms


def test_seed_terms_never_touch_held_out_terms():
    heldout = heldout_terms()
    assert "Voxbrief" in heldout and "Grafana" in heldout
    assert [t["term"] for t in jsonl.read(TERMS_DIR / "seed_train.jsonl") if leaks(t["term"], heldout)] == []


def test_leaks_catches_near_copies():
    heldout = ["Voxbrief", "Priya Patel"]
    assert leaks("VoxBrief", heldout)
    assert leaks("Voxbrief Pro", heldout)
    assert leaks("Voxbriefs", heldout)
    assert leaks("Priya Shah", heldout)
    assert not leaks("Datadog", heldout)


def test_merge_dedupes_and_drops_leaks():
    seed = [{"term": "Datadog"}]
    generated = [{"term": "datadog"}, {"term": "Voxbriefly"}, {"term": "Calendly"}]
    assert [t["term"] for t in merge_terms(seed, generated, ["Voxbrief"])] == ["Datadog", "Calendly"]


def test_clean_entry():
    entry = clean_entry({"term": " Calendly ", "hint": "scheduling app", "aliases": ["calendar Lee", "Calendly"]}, "product")
    assert entry == {"term": "Calendly", "kind": "product", "hint": "scheduling app", "aliases": ["calendar Lee"]}
    assert clean_entry({"term": "Notion"}, "common_word")["common_word"] is True
    assert clean_entry({"term": ""}, "product") is None


def _terms():
    return jsonl.read(TERMS_DIR / "seed_train.jsonl")


def test_plan_is_deterministic_and_follows_the_mix(run):
    terms = _terms()
    rng_a, rng_b = random.Random(1), random.Random(1)
    first = [plan_scenario(rng_a, i, run.config, terms) for i in range(400)]
    second = [plan_scenario(rng_b, i, run.config, terms) for i in range(400)]
    assert first == second
    shares = {k: sum(s["kind"] == k for s in first) / len(first) for k in KINDS}
    for kind, share in run["mix"].items():
        assert abs(shares[kind] - share) < 0.08, (kind, shares[kind])


def test_plan_scenarios_are_consistent(run):
    terms = _terms()
    rng = random.Random(3)
    for i in range(300):
        s = plan_scenario(rng, i, run.config, terms)
        names = [e["term"] for e in s["dictionary"]]
        assert (s["template"] is None) == (s["mode"] == "light")
        if s["kind"] == "plain":
            assert names == [] and s["spoken"] == []
        if s["kind"] == "correction":
            assert s["spoken"] and set(s["spoken"]) <= set(names)
        if s["kind"] == "negative_lookalike":
            assert s["lookalike"] in names and not s["spoken"]
        if s["kind"] == "negative_unused":
            assert names and not s["spoken"]
        assert len(names) <= run["dictionary"]["max_entries"]
