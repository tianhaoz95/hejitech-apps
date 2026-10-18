import random
import sys

from weehours_ml.config import PROJECT_DIR
from weehours_ml.laya import NONE, Registry, laya_questions, training_row
from weehours_ml.stages.asr import strip_prompt
from weehours_ml.stages.build import near_eval, normalize
from weehours_ml.stages.plan import plan_one
from weehours_ml.stages.utterances import describe, label_questions, valid_utterance

EXPORT = {"questions": [
    {"id": "category", "instructions": "What is it about?",
     "options": [{"key": "bottle", "description": "bottle feeding"}, {"key": NONE, "description": "something else"}]},
    {"id": "amount", "instructions": "How much?", "options": [{"key": "half", "description": None}]},
], "rows": []}


def test_labels_follow_logeval_gold():
    r = Registry()
    assert r.labels("feed.bottle.finish", {"amount": "half"}) == {"category": "bottle", "phase": "finish", "amount": "half"}
    assert r.labels("feed.bottle.single", {"amount": "full", "contents": "formula"}) == \
        {"category": "bottle", "phase": "single", "amount": "full", "contents": "formula"}
    assert r.labels("diaper", {"diaper_kind": "wet"}) == {"category": "diaper", "diaper_kind": "wet"}
    assert r.labels("weight", {}) == {"category": "growth"}          # growth has no phase
    assert r.labels("pump", {"side": "left"}) == {"category": "pumping", "side": "left"}
    assert r.labels(NONE, {}) == {"category": NONE}


def test_training_rows_are_the_apps_request_plus_answers():
    questions = laya_questions(EXPORT)
    assert list(questions) == ["category", "amount"]  # order kept
    assert questions["amount"]["criteria"] == {"half": None}
    row = training_row("finished, drank half", questions, {"category": "bottle", "phase": "finish", "amount": "half"})
    assert row == {"state": "finished, drank half", "questions": questions,
                   "expected": {"category": "bottle", "amount": "half"}}  # phase not asked here


def test_plan_is_deterministic_and_labels_match_the_registry(run):
    r = Registry()
    rng1, rng2 = random.Random(5), random.Random(5)
    first = [plan_one(rng1, i, run.config, r) for i in range(500)]
    second = [plan_one(rng2, i, run.config, r) for i in range(500)]
    assert first == second
    for p in first:
        assert p["labels"] == r.labels(p["type"], p["fields"])
        assert set(p["fields"]) == set(r.field_questions(p["type"]))
        for q, key in p["fields"].items():
            assert key in r.questions[q]["options"]
    share = sum(p["type"] == NONE for p in first) / len(first)
    assert abs(share - run["types"][NONE]) < 0.05


def test_teacher_requests():
    r = Registry()
    plan = {"id": "p000003", "type": "feed.bottle.finish", "fields": {"amount": "not_stated"},
            "labels": {"category": "bottle", "phase": "finish", "amount": "not_stated"}, "when": "clock", "child": "Mia"}
    text = describe(plan, r)
    assert "finished a bottle" in text and "Don't say anything that answers: How much" in text
    assert "clock time" in text and "Mia" in text
    none = dict(plan, type=NONE, fields={}, labels={"category": NONE})
    assert "NOT a feed" in describe(none, r)
    single = dict(plan, type="feed.bottle.single", labels={"category": "bottle", "phase": "single"}, when="now")
    assert "already over" in describe(single, r) and "happening now" not in describe(single, r)
    assert list(label_questions(plan, {"category": 1, "phase": 2, "side": 3, "amount": 4})) == ["category", "phase", "amount"]
    assert valid_utterance("done with the bottle, drank half")
    assert not valid_utterance("[Music]") and not valid_utterance("")


def test_build_holds_out_eval_utterances():
    held = [normalize("Finished drinking, drank half a bottle five minutes ago")]
    assert near_eval("finished drinking drank half a bottle five minutes ago!", held)
    assert near_eval("finished drinking, drank half a bottle five minutes ago.", held)
    assert not near_eval("she pooped through her onesie", held)
    assert strip_prompt(" bottle, diaper she drank half", " bottle, diaper") == "she drank half"


def test_report_renders_two_columns():
    sys.path.insert(0, str(PROJECT_DIR / "eval"))
    import report

    a = {"type_accuracy": 90, "per_question_accuracy": {"category": 80}, "model": "ft", "rows_evaluated": 178}
    b = {"type_accuracy": 81, "per_question_accuracy": {"category": 36}, "model": "stock", "rows_evaluated": 178}
    out = report.render("Raw", [("fine-tuned", a), ("stock", b)])
    assert "| Type accuracy | 90 | 81 | +9.0 |" in out
    assert "| `category` accuracy | 80 | 36 | +44.0 |" in out
