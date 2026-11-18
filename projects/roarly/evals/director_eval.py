"""Scores director prompts on the bundled Qwen3-0.6B-4bit with mlx-lm (Mac).

    build/venv/bin/python evals/director_eval.py [variant]

Reads P(yes) vs P(no) for the first answer token, the same choice the app makes.
"""
import json, sys, os
import mlx.core as mx
from mlx_lm import load

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, "apps/ios/App/Resources/Models/Qwen3-0.6B-4bit")
CASES = json.load(open(os.path.join(ROOT, "evals/director_cases.json")))["cases"]

VARIANTS = {
"plain": (
"You add sound effects while a parent tells a children's story out loud. For the sound named, decide whether it should play right now. Answer yes if the thing is here now: arriving, appearing, chasing, acting or making its noise. Answer no if it is leaving, running away, gone, asleep, quiet, far away, only imagined, negated, or just being talked about. Reply with one word: yes or no.",
lambda c: (("Story so far: " + " ".join(c["story"]) + "\n") if c["story"] else "") + f"Just said: \"{c['line']}\"\nSound: the {c['cue']}\nPlay it now? yes or no"),
"fewshot": (
"You decide whether a sound effect fits the moment in a children's story told out loud. Reply with one word: yes or no.\n\nExamples:\n\"A tiger is chasing you!\" Sound: tiger. → yes\n\"Look, the tiger is running away.\" Sound: tiger. → no\n\"Suddenly a bear jumped out!\" Sound: bear. → yes\n\"The bear was fast asleep.\" Sound: bear. → no\n\"There was no lion anywhere.\" Sound: lion. → no\n\"Here comes the big elephant!\" Sound: elephant. → yes\n\"Remember the cow at the farm?\" Sound: cow. → no\n\"The dog wagged his tail and looked at us.\" Sound: dog. → yes",
lambda c: (("Earlier: " + " ".join(c["story"]) + "\n") if c["story"] else "") + f"\"{c['line']}\" Sound: {c['cue']}. →"),
"inverse": (
"You help add sound effects to a children's story told out loud. Read the sentence and answer one question with one word, yes or no: is the animal or thing absent right now (leaving, running away, gone, asleep, quiet, only remembered, imagined or negated)?",
lambda c: (("Earlier: " + " ".join(c["story"]) + "\n") if c["story"] else "") + f"Sentence: \"{c['line']}\"\nThing: the {c['cue']}\nIs it absent right now? yes or no"),
"choice": (
"You read one sentence from a children's story and say what the animal or thing is doing right now. Answer with one letter.\nA: it is here and doing something now (coming, chasing, jumping, looking, talking, making noise)\nB: it is not here or is still (leaving, running away, gone, asleep, quiet, remembered, imagined, or there is none)",
lambda c: (("Earlier: " + " ".join(c["story"]) + "\n") if c["story"] else "") + f"Sentence: \"{c['line']}\"\nWhat is the {c['cue']} doing? A or B"),
}

model, tok = load(MODEL)
YES_WORDS = ["yes", " yes", "Yes", " Yes"]
NO_WORDS = ["no", " no", "No", " No"]
if len(sys.argv) > 1 and sys.argv[1] == "choice":
    YES_WORDS = ["A", " A"]; NO_WORDS = ["B", " B"]
yes_ids = [tok.encode(w, add_special_tokens=False)[0] for w in YES_WORDS]
no_ids = [tok.encode(w, add_special_tokens=False)[0] for w in NO_WORDS]

def p_yes(system, user):
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    prompt = tok.apply_chat_template(msgs, add_generation_prompt=True, tokenize=False, enable_thinking=False)
    ids = mx.array(tok.encode(prompt, add_special_tokens=False))[None]
    logits = model(ids)[0, -1]
    pr = mx.softmax(logits.astype(mx.float32))
    y = sum(pr[i].item() for i in yes_ids); n = sum(pr[i].item() for i in no_ids)
    return y / max(y + n, 1e-9)

for name in (sys.argv[1:] or VARIANTS.keys()):
    system, user = VARIANTS[name]
    scores = []
    for c in CASES:
        p = p_yes(system, user(c))
        if name == "inverse": p = 1 - p
        scores.append((p, c["play"], c["line"]))
    # best threshold
    best = max(((sum((p >= t) == want for p, want, _ in scores), t) for t in [x / 100 for x in range(1, 100)]))
    acc05 = sum((p >= 0.5) == want for p, want, _ in scores)
    print(f"{name}: at 0.5 {acc05}/{len(scores)}, best {best[0]}/{len(scores)} at threshold {best[1]:.2f}")
    if "-v" in sys.argv or len(sys.argv) > 1:
        for p, want, line in scores:
            print(f"   {p:.2f} want {'yes' if want else 'no '}  {line}")
