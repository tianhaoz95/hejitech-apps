"""Stage `scenarios`: the teacher writes the clean, correctly spelled voice memo for every plan
entry. What the speaker *said*; the ASR stages then produce what the app *hears*."""

import asyncio
import re

from .. import jsonl

TEMPLATE_INTENT = {
    "Design Doc": "describes how a system or project should work: requirements, if/then conditions or steps, and follow-up tasks",
    "Email": "asks to write or send an email to a named person and says what it should say",
    "Short Tweet": "asks to post a tweet or short social post and says what it should say",
    "Task List": "lists several separate to-dos, often run together in one sentence",
    "General Notes": "is an open-ended thought, reflection or idea with no list of tasks",
}
SYSTEM = (
    "You write realistic voice memos exactly as a person would speak them into a phone or watch: "
    "first person, conversational, sometimes rambling, with the occasional filler word (um, uh, "
    "so, like) or restart. Never use markdown, lists, quotes, emoji or dictation commands such as "
    "'new line' or 'period'. Answer with only a JSON object: {\"transcript\": \"...\"}."
)


def build_request(scenario):
    parts = [f"The speaker is {scenario['persona']}, talking about {scenario['topic']}."]
    if scenario["mode"] == "full":
        parts.append(f"The memo {TEMPLATE_INTENT[scenario['template']]}.")
    else:
        parts.append("The memo is a few sentences of ordinary dictation.")
    kind = scenario["kind"]
    if kind == "correction":
        terms = ", ".join(f'"{t}"' for t in scenario["spoken"])
        parts.append(f"Naturally mention {terms}, spelled exactly like that, in a way that makes clear what each is.")
    elif kind == "negative_lookalike":
        word = scenario["lookalike"].lower()
        parts.append(f"Use the ordinary English word \"{word}\" in its everyday meaning (not as a product name). "
                     "Don't mention any software or apps.")
    if kind != "correction":
        avoid = [e["term"] for e in scenario["dictionary"] if e["term"] != scenario.get("lookalike")]
        if avoid:
            parts.append("Do not mention any of: " + ", ".join(avoid) + ".")
    parts.append("Length: 1 to 5 sentences, at most 70 words.")
    return " ".join(parts)


def _mentions(text, term):
    return re.search(rf"(?<!\w){re.escape(term)}(?!\w)", text, re.IGNORECASE) is not None


def valid_transcript(scenario, transcript):
    """Whether the teacher's memo does what the plan asked."""
    if not isinstance(transcript, str):
        return False
    words = len(transcript.split())
    if not 6 <= words <= 80 or any(ch in transcript for ch in "[]*#\n"):
        return False
    for entry in scenario["dictionary"]:
        term = entry["term"]
        if term in scenario["spoken"]:
            if term not in transcript:  # exact spelling
                return False
        elif term == scenario.get("lookalike"):
            if not _mentions(transcript, term) or term in transcript:  # the lowercase word only
                return False
        elif _mentions(transcript, term):
            return False
    return True


async def _run(run, scenarios, out):
    from ..teacher import Teacher, run_all

    teacher = Teacher(run["teacher"])

    async def worker(scenario):
        value = await teacher.json(
            SYSTEM, build_request(scenario),
            validate=lambda v: valid_transcript(scenario, v.get("transcript")),
        )
        return None if value is None else dict(scenario, transcript=value["transcript"].strip())

    with jsonl.Appender(out) as sink:
        failed = await run_all(scenarios, worker, sink, "scenarios")
    print(f"scenarios: {failed} plan entries got no valid memo (dropped)")


def run_stage(run, limit=None):
    plan = jsonl.read(run.path("plan.jsonl"))
    out = run.path("scenarios.jsonl")
    done = jsonl.done_ids(out)
    todo = [s for s in plan if s["id"] not in done][:limit]
    print(f"scenarios: {len(todo)} to write ({len(done)} already done)")
    if todo:
        asyncio.run(_run(run, todo, out))
