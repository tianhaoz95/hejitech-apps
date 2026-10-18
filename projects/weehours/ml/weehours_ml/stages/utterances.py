"""Stage `utterances`: the teacher writes `variants` things a tired parent would say for each
plan, then labels every one of them blind, with the app's own questions and nothing else. An
utterance survives only if the blind labels equal the plan's: the plan fixes what's true, the
blind pass catches utterances that don't actually say it."""

import asyncio
import re

from .. import jsonl
from ..laya import NONE, Registry, load_export

WRITE_SYSTEM = (
    "You write what exhausted new parents actually say into a baby-log app, often at 3 am, one "
    "hand holding the baby: short (2 to 16 words), casual, sometimes fragments or missing the "
    "subject, sometimes rambling, occasional filler (um, uh, okay so) or self-correction. No "
    "quotes, emoji, lists or explanations. Answer with only a JSON object: {\"utterances\": [...]}."
)
LABEL_SYSTEM = (
    "You label what a parent said into a baby-log app. For each question pick exactly one option "
    "key, judging only from the words said. Answer with only a JSON object mapping each question "
    "id to the chosen option key."
)
WHEN_TEXT = {
    "now": "It is happening now; don't mention a time.",
    "relative": "Say how long ago it was (like ten minutes ago, half an hour ago).",
    "clock": "Say the clock time it happened (like at 3:40, around two).",
    "vague": "Say the time vaguely (like a bit ago, earlier, just now).",
}
NONE_TOPICS = [
    "a rash or symptom", "a question for the pediatrician", "a milestone like a first smile",
    "the baby being fussy or crying", "buying more diapers or formula", "a visitor", "bath time",
    "giving vitamin drops or medicine", "tummy time", "the parent's own tiredness",
]


def describe(plan, registry):
    """The plan in words for the teacher, from the spec's own descriptions."""
    if plan["type"] == NONE:
        topic = NONE_TOPICS[int(plan["id"][1:]) % len(NONE_TOPICS)]
        parts = [f"Something about {topic} that is NOT a feed, diaper change, sleep, pumping or "
                 "growth measurement entry."]
    else:
        spec = registry.types[plan["type"]]
        parts = [f"Meaning: {spec['voice']}."]
        for q, key in plan["fields"].items():
            question = registry.questions[q]
            if key == "not_stated":
                parts.append(f"Don't say anything that answers: {question['instructions']}")
            else:
                desc = question["options"][key].get("description") or key.replace("_", " ")
                parts.append(f"It must clearly answer \"{question['instructions']}\" with: {desc}.")
    if plan["type"] in ("weight", "height", "head"):
        parts.append("Include the measurement with a number and unit.")
    parts.append(WHEN_TEXT[plan["when"]])
    if plan["child"]:
        parts.append(f"Mention the baby by name: {plan['child']}.")
    return " ".join(parts)


def label_request(utterance, questions):
    lines = [f'The parent said: "{utterance}"', "", "Questions:"]
    for qid, q in questions.items():
        options = "; ".join(f"{k}" + (f" ({d})" if d else "") for k, d in q["criteria"].items())
        lines.append(f"- {qid}: {q['instructions']} Options: {options}")
    return "\n".join(lines)


def label_questions(plan, all_questions):
    """The questions the blind pass answers: those the plan has labels for."""
    return {q: all_questions[q] for q in all_questions if q in plan["labels"]}


def valid_utterance(text):
    if not isinstance(text, str):
        return False
    words = len(text.split())
    return 1 <= words <= 25 and not re.search(r"[\[\]{}*#\n]", text)


async def _run(run, plans, questions, registry, out):
    from ..teacher import Teacher, run_all

    teacher = Teacher(run["teacher"])
    variants = run["run"]["variants"]

    async def worker(plan):
        written = await teacher.json(
            WRITE_SYSTEM, f"Write {variants} different things a parent might say. {describe(plan, registry)}",
            validate=lambda v: isinstance(v.get("utterances"), list))
        if written is None:
            return None
        asked = label_questions(plan, questions)
        kept = []
        for text in [u.strip() for u in written["utterances"] if valid_utterance(u)][:variants]:
            blind = await teacher.json(LABEL_SYSTEM, label_request(text, asked), temperature=0,
                                       validate=lambda v: all(q in v for q in asked))
            if blind is None:
                continue
            agrees = all(str(blind[q]).strip() == plan["labels"][q] for q in asked)
            kept.append({"text": text, "blind": {q: blind[q] for q in asked}, "agrees": agrees})
        return dict(plan, utterances=kept)

    with jsonl.Appender(out) as sink:
        failed = await run_all(plans, worker, sink, "utterances")
    print(f"utterances: {failed} plans got nothing usable (dropped)")


def run_stage(run, limit=None):
    from ..laya import laya_questions

    registry = Registry()
    questions = laya_questions(load_export(run.laya_export))
    plans = jsonl.read(run.path("plan.jsonl"))
    out = run.path("utterances.jsonl")
    done = jsonl.done_ids(out)
    todo = [p for p in plans if p["id"] not in done][:limit]
    print(f"utterances: {len(todo)} plans to write ({len(done)} already done)")
    if todo:
        asyncio.run(_run(run, todo, questions, registry, out))
