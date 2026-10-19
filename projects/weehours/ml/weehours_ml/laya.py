"""What the app asks Laya, so training rows are exactly the app's requests.

The questions come from the app itself: `logeval --export` writes the hierarchical questions in
the order the app sends them (option order matters to Laya) plus each eval utterance's gold
labels. The labelling rule (logeval's `gold()`: type → category, phase, fields) is ported here
from spec/event-types.json, and `verify_against_export` checks it against every exported row.
"""

import json
from pathlib import Path

from .config import SPEC_DIR

NONE = "none_of_these"
FIELD_QUESTIONS = ["amount", "side", "contents", "diaper_kind", "solids_amount"]


class Registry:
    """The parts of spec/event-types.json the labels need."""

    def __init__(self, spec=None):
        spec = spec or json.loads((SPEC_DIR / "event-types.json").read_text())
        self.spec = spec
        self.types = {t["id"]: t for t in spec["types"]}
        self.categories = {c["id"]: c for c in spec["categories"]}
        self.questions = spec["questions"]

    def group_of(self, category):
        """The spec's modelGroups entry holding `category` (EventRegistry.modelGroup(of:))."""
        return next(g for g in self.spec["modelGroups"] if category in g["categories"])

    def in_model(self, category):
        return self.categories[category].get("model", True)

    def questions_for(self, export, enabled):
        """The app's questions for a household with only `enabled` categories on
        (VoiceInterpreter.questions), cut from the all-categories export: groups without an enabled
        category, entry questions left with one category, phases and field questions no enabled
        type uses go; option order is kept."""
        enabled = {c for c in enabled if self.in_model(c)}
        types = [t for t in self.types.values() if t["category"] in enabled]
        kept = {g["id"]: [c for c in g["categories"] if c in enabled] for g in self.spec["modelGroups"]}
        roles = {self.role(t["id"]) for t in types} - {None}
        needed = {q for t in types for q in t.get("questions", [])}
        out = []
        for q in export["questions"]:
            qid, options = q["id"], q["options"]
            if qid == "category":
                options = [o for o in options if o["key"] == NONE or kept.get(o["key"])]
            elif qid == "phase":
                options = [o for o in options if o["key"] in roles]
                if len(options) < 2:
                    continue
            elif qid.endswith("_entry"):
                cats = kept.get(qid[: -len("_entry")], [])
                if len(cats) < 2:
                    continue
                options = [o for o in options if o["key"] in cats]
            elif qid not in needed:
                continue
            out.append(dict(q, options=options))
        return dict(export, questions=out)

    def role(self, type_id):
        """VoiceInterpreter.role: the phase key of a type, if any."""
        if type_id == "feed.bottle.single":
            return "single"
        return (self.types[type_id].get("session") or {}).get("role")

    def field_questions(self, type_id):
        if type_id == NONE:
            return []
        return [q for q in self.types[type_id].get("questions", []) if q in FIELD_QUESTIONS]

    def labels(self, type_id, fields):
        """logeval's gold(): the expected option per question for an entry of `type_id` with the
        given field values ({question: option key})."""
        if type_id == NONE:
            return {"category": NONE}
        spec = self.types[type_id]
        group = self.group_of(spec["category"])
        labels = {"category": group["id"]}   # the first level is the model group
        if len(group["categories"]) > 1:
            labels[entry_question(group["id"])] = spec["category"]
        same_category = [t for t in self.types.values() if t["category"] == spec["category"]]
        role = self.role(type_id)
        if len(same_category) > 1 and role:
            labels["phase"] = role
        for q in self.field_questions(type_id):
            if q in fields:
                labels[q] = fields[q]
        return labels


def entry_question(group):
    """EventRegistry.entryQuestion: the question picking a category inside `group`."""
    return f"{group}_entry"


def load_export(path):
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"{path} not found: run `logeval --export` first (see ml/README.md)")
    return json.loads(path.read_text())


def laya_questions(export):
    """The export's questions in laya's request shape ({id: {type, instructions, criteria}}),
    order preserved: the same JSON the app posts to /v1/systemone."""
    return {q["id"]: {"type": "choice", "instructions": q["instructions"],
                      "criteria": {o["key"]: o["description"] for o in q["options"]}}
            for q in export["questions"]}


def training_row(state, questions, labels):
    """One laya.train row: the app's request plus the expected answer per labelled question."""
    return {"state": state, "questions": questions,
            "expected": {q: v for q, v in labels.items() if q in questions}}


def verify_against_export(export, utterances_path=SPEC_DIR / "utterances.jsonl", registry=None):
    """Problems (empty when in sync) between this port and the app's labels for the eval rows."""
    registry = registry or Registry()
    rows = [json.loads(line) for line in Path(utterances_path).read_text().splitlines() if line.strip()]
    problems = []
    if len(rows) != len(export["rows"]):
        problems.append(f"export has {len(export['rows'])} rows, utterances.jsonl {len(rows)}: re-export")
    asked = {q["id"] for q in export["questions"]}
    for row, exported in zip(rows, export["rows"]):
        expect = dict(row["expect"])
        type_id = expect.pop("type")
        ours = {q: v for q, v in registry.labels(type_id, expect).items() if q in asked}
        if ours != exported["gold"]:
            problems.append(f"{row['text']!r}: ours {ours} != app {exported['gold']}")
    for q in export["questions"]:
        keys = [o["key"] for o in q["options"]]
        if q["id"] in registry.questions and q["id"] not in ("category", "phase"):
            spec_keys = list(registry.questions[q["id"]].get("options", {}))
            if keys != spec_keys:
                problems.append(f"question {q['id']}: options {keys} != spec {spec_keys}")
    return problems
