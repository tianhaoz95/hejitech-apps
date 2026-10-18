"""Stage `targets`: the teacher writes the answer Lite should give. It sees the app's own system
prompt and the misheard transcript exactly as Lite will, plus what the speaker actually said,
which only the teacher gets (that's how it knows "Wotsbrief" means "Voxbrief"). Full notes also
get the teacher's own template classification, so the filter can drop memos whose planned
template the teacher disagrees with."""

import asyncio
import json

from .. import jsonl
from ..app_prompts import app_transcript, load_kit

TARGET_SYSTEM = (
    "You write the ideal response of a small on-device model inside a voice-notes app, to be used "
    "as its training target. Follow the app's instructions to the letter and answer with only the "
    "JSON object they ask for: no code fences, no commentary.\n"
    "Rules on top of the app's instructions:\n"
    "- Base everything on what the speaker actually said. The model only sees the speech-recognized "
    "transcript, so fix its mishearings, but never add facts the speaker didn't say.\n"
    "- A personal-dictionary term the speaker said is written with the dictionary's exact spelling "
    "and capitalization everywhere, title included.\n"
    "- Never mention a dictionary term the speaker didn't say. An ordinary word that happens to "
    "match a product name keeps its ordinary meaning and lowercase spelling.\n"
    "- Title: at most 8 words. Tags: 1 to 4 short hashtags starting with #.\n"
    "- Light proofreading (a \"cleanedText\" key): keep the speaker's wording and sentence order, "
    "remove filler words (um, uh, like, you know) and bracketed tags such as [Music], fix "
    "mishearings, and nothing else."
)


def target_request(app_system, app_user, said):
    return (
        "THE APP'S SYSTEM PROMPT FOR THE SMALL MODEL:\n<<<\n" + app_system + "\n>>>\n\n"
        "WHAT THE SMALL MODEL RECEIVES AS THE USER MESSAGE:\n<<<\n" + app_user + "\n>>>\n\n"
        "WHAT THE SPEAKER ACTUALLY SAID (only you see this):\n<<<\n" + said + "\n>>>\n\n"
        "Write the small model's ideal response."
    )


def has_keys(value, keys):
    return all(k in value for k in keys)


async def _run(run, kit, items, out):
    from ..teacher import Teacher, run_all

    teacher = Teacher(run["teacher"])

    async def worker(item):
        scenario, asr = item
        dictionary = scenario["dictionary"]
        heard = app_transcript(asr, dictionary)
        if not heard:
            return None
        user = kit.user_prompt(heard, dictionary)
        record = {"id": scenario["id"], "input": heard}
        if scenario["mode"] == "light":
            system = kit.light_system(dictionary)
            keys = ["title", "summary", "cleanedText", "tags"]
        else:
            template = scenario["template"]
            system = kit.generation_system(template, dictionary)
            keys = ["title", "summary", "tags"] + kit.field_keys(template)
            choice = await teacher.json(kit.classification_system(), scenario["transcript"], temperature=0,
                                        validate=lambda v: isinstance(v.get("template"), str))
            record["teacher_template"] = choice["template"].strip() if choice else None
        target = await teacher.json(TARGET_SYSTEM, target_request(system, user, scenario["transcript"]),
                                    temperature=0.2, validate=lambda v: has_keys(v, keys))
        if target is None:
            return None
        record["target"] = json.dumps(target, ensure_ascii=False)
        return record

    with jsonl.Appender(out) as sink:
        failed = await run_all(items, worker, sink, "targets")
    print(f"targets: {failed} scenarios got no valid target (dropped)")


def run_stage(run, limit=None):
    kit = load_kit(run.prompts_export)
    scenarios = {s["id"]: s for s in jsonl.read(run.path("scenarios.jsonl"))}
    asr = jsonl.read(run.path("asr.jsonl"))
    out = run.path("targets.jsonl")
    done = jsonl.done_ids(out)
    items = [(scenarios[r["id"]], r["asr"]) for r in asr if r["id"] not in done][:limit]
    print(f"targets: {len(items)} to write ({len(done)} already done)")
    if items:
        asyncio.run(_run(run, kit, items, out))

