"""Stage `terms`: the training term bank = terms/seed_train.jsonl + terms the teacher invents.

Held-out terms (terms/heldout.jsonl, and every term in the eval's cases.json) never enter
training, nor does anything that looks like one, so the eval measures whether the model learned
to fix *any* term rather than memorized these."""

import asyncio
import difflib
import json

from .. import jsonl
from ..config import EVAL_DIR, TERMS_DIR

KINDS = {
    "product": "software products, apps and companies, many with coined or compound names (like Zapier, Calendly, Monzo)",
    "person": "people's full names from many cultures (Irish, Nigerian, Vietnamese, Polish, Indian, Chinese, Arabic, Spanish...)",
    "jargon": "technical, medical, legal or finance jargon and acronyms people dictate (like Kubernetes, HbA1c, EBITDA)",
    "place": "office buildings, neighborhoods, venues and small towns with unusual names",
    "common_word": "products whose name is an ordinary English word (like Notion, Slack, Linear, Bear, Things)",
}
SYSTEM = (
    "You invent realistic entries for a voice-notes app's personal dictionary: the proper nouns "
    "and jargon a speech recognizer gets wrong. Answer with only a JSON object."
)


def heldout_terms():
    terms = [t["term"] for t in jsonl.read(TERMS_DIR / "heldout.jsonl")]
    cases = json.loads((EVAL_DIR / "cases.json").read_text())
    terms += [entry["term"] for case in cases for entry in case.get("dictionary") or []]
    return sorted(set(terms))


def _norm(term):
    return "".join(ch for ch in term.lower() if ch.isalnum())


def leaks(term, heldout):
    """True when `term` is, contains, or reads almost like a held-out term."""
    key = _norm(term)
    for other in heldout:
        other_key = _norm(other)
        if not key or not other_key:
            continue
        if key == other_key or other_key in key or key in other_key:
            return True
        if difflib.SequenceMatcher(None, key, other_key).ratio() >= 0.75:
            return True
        # Any shared word of a multi-word name ("Priya Shah" vs "Priya Patel").
        if set(term.lower().split()) & set(other.lower().split()) - {"dr.", "the"}:
            return True
    return False


def clean_entry(raw, kind):
    term = str(raw.get("term", "")).strip()
    if not term or len(term) > 40:
        return None
    entry = {"term": term, "kind": "product" if kind == "common_word" else kind}
    hint = str(raw.get("hint") or "").strip()
    if hint:
        entry["hint"] = hint[:60]
    aliases = [str(a).strip() for a in raw.get("aliases") or [] if str(a).strip()]
    aliases = [a for a in aliases if a.lower() != term.lower()][:3]
    if aliases:
        entry["aliases"] = aliases
    if kind == "common_word" or raw.get("common_word"):
        entry["common_word"] = True
    return entry


def merge_terms(seed, generated, heldout):
    """Seed terms first, then generated ones; drops duplicates and anything near a held-out term."""
    merged, seen = [], set()
    for entry in seed + generated:
        key = _norm(entry["term"])
        if key in seen or leaks(entry["term"], heldout):
            continue
        seen.add(key)
        merged.append(entry)
    return merged


async def _generate(run, count):
    from ..teacher import Teacher

    teacher = Teacher(run["teacher"])
    per_request = 25
    requests = []
    kinds = list(KINDS)
    for i in range(max(1, -(-count // per_request))):
        kind = kinds[i % len(kinds)]
        requests.append((i, kind))

    async def one(request):
        i, kind = request
        user = (
            f"Invent {per_request} different dictionary entries of this kind: {KINDS[kind]}. "
            "Mix famous real ones with plausible made-up ones. For each give: \"term\" (exact "
            "spelling and capitalization), \"hint\" (2-6 words saying what it is), and \"aliases\" "
            "(1-3 ways a speech recognizer would likely mis-transcribe it when spoken, e.g. "
            "\"Calendly\" -> \"calendar Lee\"). "
            f"Variation seed {i}. Answer as {{\"entries\": [{{\"term\": ..., \"hint\": ..., \"aliases\": [...]}}]}}."
        )
        value = await teacher.json(SYSTEM, user, validate=lambda v: isinstance(v.get("entries"), list))
        if value is None:
            return None
        return [e for e in (clean_entry(raw, kind) for raw in value["entries"] if isinstance(raw, dict)) if e]

    results = await asyncio.gather(*(one(r) for r in requests))
    return [entry for batch in results if batch for entry in batch]


def run_stage(run, limit=None):
    out = run.path("terms.jsonl")
    heldout = heldout_terms()
    seed = jsonl.read(TERMS_DIR / "seed_train.jsonl")
    count = run["terms"]["generate"] if limit is None else min(limit, run["terms"]["generate"])
    generated = asyncio.run(_generate(run, count)) if count else []
    terms = merge_terms(seed, generated, heldout)
    jsonl.write(out, [dict(entry, id=f"term-{i:05d}") for i, entry in enumerate(terms)])
    print(f"terms: {len(terms)} train terms ({len(seed)} seed, {len(generated)} generated before "
          f"dedupe and held-out filtering) -> {out}")
