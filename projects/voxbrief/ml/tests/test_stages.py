import json

from voxbrief_ml.stages.asr import strip_prompt, vocabulary_prompt
from voxbrief_ml.stages.build import examples_for, in_validation
from voxbrief_ml.stages.filter import check, expectations, light_similarity, misheard
from voxbrief_ml.stages.scenarios import build_request, valid_transcript
from voxbrief_ml.stages.train import Collator, encode


def scenario(**overrides):
    base = {"id": "s000001", "kind": "correction", "mode": "full", "template": "Task List",
            "persona": "a nurse", "topic": "groceries", "lookalike": None,
            "dictionary": [{"term": "Voxbrief"}, {"term": "Datadog"}], "spoken": ["Voxbrief"],
            "transcript": "Um so I need to update Voxbrief, then buy milk and call the bank."}
    base.update(overrides)
    return base


def test_valid_transcript_follows_the_plan():
    s = scenario()
    assert valid_transcript(s, s["transcript"])
    assert not valid_transcript(s, "I need to update voxbrief and buy milk today.")  # spelling
    assert not valid_transcript(s, "Update Voxbrief and check Datadog, then buy milk.")  # unspoken term
    assert not valid_transcript(s, "Too short.")
    look = scenario(kind="negative_lookalike", spoken=[], lookalike="Slack",
                    dictionary=[{"term": "Slack"}], transcript="")
    assert valid_transcript(look, "There is some slack in the schedule so we can wait a week.")
    assert not valid_transcript(look, "Post it in Slack so the whole team can see it.")
    assert "slack" in build_request(look) and "Voxbrief" not in build_request(look)


def test_asr_helpers():
    assert vocabulary_prompt([{"term": "Voxbrief"}, {"term": " Supabase "}]) == " Voxbrief, Supabase"
    assert vocabulary_prompt([]) is None
    assert strip_prompt(" Voxbrief, Supabase For the Wotsbrief project.", " Voxbrief, Supabase") == "For the Wotsbrief project."


def target(**fields):
    base = {"title": "Voxbrief update and errands", "summary": "Update Voxbrief and run errands.",
            "tasks": ["Update Voxbrief", "Buy milk", "Call the bank"], "tags": ["#errands"]}
    base.update(fields)
    return json.dumps(base)


def test_filter_accepts_a_good_target_and_names_failures(kit):
    s = scenario()
    record = {"id": s["id"], "input": "Um so I need to update Wotsbrief, then buy milk.",
              "teacher_template": "task list", "target": target()}
    assert check(s, record, kit, 0.6) == []
    assert misheard(s, record["input"]) == ["Voxbrief"]
    bad = dict(record, target=target(summary="Check Datadog too.", title="Wotsbrief"))
    failures = check(s, bad, kit, 0.6)
    assert "has 'Voxbrief'" not in failures  # still in the tasks
    assert "no 'Datadog'" in failures
    assert "template" in check(s, dict(record, teacher_template="General Notes"), kit, 0.6)


def test_filter_light_mode(kit):
    s = scenario(mode="light", template=None, kind="plain", dictionary=[], spoken=[],
                 transcript="Um so we ship the beta on Monday and then gather feedback.")
    good = {"title": "Beta on Monday", "summary": "Ship the beta.", "tags": ["#beta"],
            "cleanedText": "So we ship the beta on Monday and then gather feedback."}
    assert check(s, {"target": json.dumps(good)}, kit, 0.6) == []
    assert check(s, {"target": json.dumps(dict(good, cleanedText="Beta."))}, kit, 0.6) == ["light keeps content"]
    assert light_similarity("ship the beta", "um ship the beta") == 1.0
    assert expectations(s)["not_words_ci"]


def test_build_uses_the_app_prompts(kit):
    s = scenario()
    record = {"id": s["id"], "input": "update Wotsbrief, then buy milk", "target": target(), "misheard": ["Voxbrief"]}
    classify, generate = examples_for(s, record, kit)
    assert classify["prompt"][0]["content"] == "CLASSIFY"
    assert classify["prompt"][1]["content"] == "update Wotsbrief, then buy milk"
    assert json.loads(classify["completion"]) == {"template": "Task List"}
    assert generate["prompt"][0]["content"].startswith("GEN tasks.\n\nPersonal dictionary:")
    assert generate["prompt"][1]["content"].endswith("Transcript:\nupdate Wotsbrief, then buy milk")
    assert json.loads(generate["completion"])["tasks"][0] == "Update Voxbrief"
    assert in_validation("s000001", 1.0) and not in_validation("s000001", 0.0)


class FakeTokenizer:
    def apply_chat_template(self, messages, add_generation_prompt, enable_thinking, tokenize):
        assert add_generation_prompt and enable_thinking is False and tokenize is False
        return "".join(m["content"] for m in messages) + "|A|"

    def __call__(self, text, add_special_tokens):
        return {"input_ids": [ord(c) for c in text]}


def test_encode_masks_the_prompt_and_ends_the_turn():
    example = {"prompt": [{"role": "system", "content": "S"}, {"role": "user", "content": "U"}], "completion": "{}"}
    encoded = encode(example, FakeTokenizer(), 100)
    prompt_len = len("SU|A|")
    assert encoded["labels"][:prompt_len] == [-100] * prompt_len
    assert "".join(map(chr, encoded["labels"][prompt_len:])) == "{}<|im_end|>\n"
    assert encode(example, FakeTokenizer(), 5) is None


def test_collator_pads():
    try:
        import torch  # noqa: F401
    except ImportError:
        return
    batch = Collator(0)([{"input_ids": [1, 2, 3], "labels": [-100, 2, 3]}, {"input_ids": [1], "labels": [1]}])
    assert batch["input_ids"].tolist() == [[1, 2, 3], [1, 0, 0]]
    assert batch["labels"].tolist() == [[-100, 2, 3], [1, -100, -100]]
