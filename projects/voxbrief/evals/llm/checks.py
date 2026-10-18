"""Checks on one Stage 2 model output, shared by the eval (`run_eval.py`) and the fine-tuning
data filter (`ml/`), so "a good note" means the same thing to both. Standard library only."""

import json
import re

# The prompt's own scaffolding must never end up in a note.
LEAK_MARKERS = ["Zentrify", "Sentrafy", "send trify", "Dictionary terms", "Transcript:"]
LIGHT_KEYS = ["title", "summary", "cleanedText", "tags"]
UNIVERSAL_KEYS = ["title", "summary", "tags"]


def extract_json(text):
    """Same rule as LLMCopywriterService.extractJSONObject: first "{" to last "}"."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        value = json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def strings_in(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [s for item in value for s in strings_in(item)]
    if isinstance(value, dict):
        return [s for item in value.values() for s in strings_in(item)]
    return []


def score_output(raw, mode, field_keys, expect, template=None):
    """List of (check, passed, detail) for one raw model output.

    `mode` is "full" or "light"; `field_keys` are the chosen template's section keys (full mode);
    `expect` uses the keys documented in evals/llm/README.md; `template` is the template the
    output was generated for (checked against `expect["template"]`)."""
    checks = []
    obj = extract_json(raw)
    checks.append(("json", obj is not None, "" if obj else "no JSON object in output"))
    if obj is None:
        return checks

    keys = LIGHT_KEYS if mode == "light" else UNIVERSAL_KEYS + list(field_keys)
    missing = [k for k in keys if k not in obj]
    checks.append(("keys", not missing, f"missing {missing}" if missing else ""))

    title = obj.get("title") if isinstance(obj.get("title"), str) else ""
    words = len(title.split())
    checks.append(("title<=8 words", 0 < words <= 8, f"{words} words: {title!r}"))

    text = "\n".join(strings_in(obj))
    body = "\n".join(s for k, v in obj.items() if k not in ("title", "tags") for s in strings_in(v))
    leaked = [m for m in LEAK_MARKERS if m.lower() in text.lower()]
    checks.append(("no prompt leak", not leaked, f"leaked {leaked}" if leaked else ""))

    if "template" in expect:
        checks.append(("template", template == expect["template"], f"chose {template}"))
    for term in expect.get("contains", []):
        checks.append((f"has {term!r}", term in text, ""))
    for term in expect.get("contains_ci", []):
        checks.append((f"has {term!r}", term.lower() in text.lower(), ""))
    for term in expect.get("not_contains_ci", []):
        checks.append((f"no {term!r}", term.lower() not in text.lower(), ""))
    for term in expect.get("body_not_contains", []):
        checks.append((f"body has no {term!r}", term not in body, ""))
    for word in expect.get("not_words_ci", []):
        found = re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE)
        checks.append((f"no word {word!r}", not found, ""))
    for key, minimum in expect.get("min_items", {}).items():
        value = obj.get(key)
        count = len(value) if isinstance(value, list) else (1 if isinstance(value, str) and value.strip() else 0)
        checks.append((f"{key}>={minimum} items", count >= minimum, f"{count} items"))
    for key in expect.get("nonempty", []):
        checks.append((f"{key} not empty", bool("".join(strings_in(obj.get(key))).strip()), ""))
    for key, limit in expect.get("max_chars", {}).items():
        length = len("".join(strings_in(obj.get(key))))
        checks.append((f"{key}<={limit} chars", 0 < length <= limit, f"{length} chars"))
    return checks
