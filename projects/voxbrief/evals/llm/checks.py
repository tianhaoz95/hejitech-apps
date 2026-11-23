"""Checks on one Stage 2 model output, shared by the eval (`run_eval.py`) and the fine-tuning
data filter (`ml/`), so "a good note" means the same thing to both. Standard library only."""

import json
import re

# The prompt's own scaffolding must never end up in a note.
LEAK_MARKERS = ["Zentrify", "Sentrafy", "send trify", "Dictionary terms", "Transcript:"]
LIGHT_KEYS = ["title", "summary", "cleanedText", "tags"]
REPORT_KEYS = ["report", "title", "summary", "tags"]
UNIVERSAL_KEYS = ["title", "summary", "tags"]
BRIEF_KEYS = ["summary", "title", "tags"]
TURNS_KEYS = ["turns"]
BRIEF_MODES = ("brief", "brief-overview")
# Openers that describe the memo instead of saying what is in it.
DESCRIBING_OPENERS = ("the speaker", "the transcript", "this memo", "the memo", "the user", "this part")


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


# Port of LLMCopywriterService's grounding rule (`isGrounded`): the app throws away a structured
# rewrite that shares less than this with the memo it was written from.
MIN_GROUNDED_SHARE = 0.3
MIN_GROUNDING_WORDS = 4
GROUNDING_STOP_WORDS = {
    "the", "and", "for", "that", "this", "with", "are", "was", "were", "but", "not", "you",
    "your", "have", "has", "had", "will", "can", "from", "they", "them", "its", "our", "all",
    "any", "should", "would", "could", "need", "needs", "also", "then", "there", "their",
    "about", "into", "some", "what", "when", "which", "who", "been", "being", "more", "make",
    "get", "use", "one", "two", "out", "how", "it's", "i'm", "we're", "don't",
}


def is_cjk(ch):
    o = ord(ch)
    return 0x4E00 <= o <= 0x9FFF or 0x3400 <= o <= 0x4DBF or 0x3040 <= o <= 0x30FF or 0xAC00 <= o <= 0xD7AF


def grounding_tokens(text):
    """Port of LLMCopywriterService.groundingTokens."""
    tokens, run, word = set(), [], []

    def flush_run():
        if len(run) == 1:
            tokens.add(run[0])
        for i in range(len(run) - 1):
            tokens.add(run[i] + run[i + 1])
        run.clear()

    def flush_word():
        w = "".join(word).lower()
        if len(w) >= 3 and w not in GROUNDING_STOP_WORDS:
            tokens.add(w[:6])
        word.clear()

    for ch in text:
        if is_cjk(ch):
            flush_word()
            run.append(ch)
        elif ch.isalnum():
            flush_run()
            word.append(ch)
        else:
            flush_run()
            flush_word()
    flush_run()
    flush_word()
    return tokens


def grounded_share(text, source):
    """Port of LLMCopywriterService.groundedShare: None when there's too little to judge."""
    written = grounding_tokens(text)
    if len(written) < MIN_GROUNDING_WORDS:
        return None
    return len(written & grounding_tokens(source)) / len(written)


def cjk_share(text):
    letters = [ch for ch in text if ch.isalpha()]
    return sum(is_cjk(ch) for ch in letters) / len(letters) if letters else 0.0


def score_output(raw, mode, field_keys, expect, template=None, source=None):
    """List of (check, passed, detail) for one raw model output.

    `mode` is "full" or "light"; `field_keys` are the chosen template's section keys (full mode);
    `expect` uses the keys documented in evals/llm/README.md; `template` is the template the
    output was generated for (checked against `expect["template"]`); `source` is the text the
    output was written from (full mode: the app keeps a structured rewrite only when it's
    grounded in it)."""
    checks = []
    obj = extract_json(raw)
    if obj is None and mode == "turns":
        # Like LLMCopywriterService.parseTurns: a bare array of turns is accepted too.
        start, end = raw.find("["), raw.rfind("]")
        try:
            value = json.loads(raw[start:end + 1]) if 0 <= start < end else None
        except json.JSONDecodeError:
            value = None
        obj = {"turns": value} if isinstance(value, list) else None
    checks.append(("json", obj is not None, "" if obj else "no JSON object in output"))
    if obj is None:
        return checks

    if mode == "turns":
        keys = TURNS_KEYS
    elif mode in BRIEF_MODES:
        keys = BRIEF_KEYS
    else:
        keys = {"light": LIGHT_KEYS, "conversation": REPORT_KEYS}.get(mode, UNIVERSAL_KEYS + list(field_keys))
    missing = [k for k in keys if k not in obj]
    checks.append(("keys", not missing, f"missing {missing}" if missing else ""))

    if mode == "turns":
        turns = obj.get("turns") if isinstance(obj.get("turns"), list) else []
        want = expect.get("turn_count")
        checks.append(("same turn count", len(turns) == want, f"{len(turns)} of {want}"))
        checks.append(("no '>>' left", not any(">>" in str(t) for t in turns), ""))
    else:
        title = obj.get("title") if isinstance(obj.get("title"), str) else ""
        words = len(title.split())
        checks.append(("title<=8 words", 0 < words <= 8, f"{words} words: {title!r}"))

    if mode in BRIEF_MODES:
        summary = obj.get("summary") if isinstance(obj.get("summary"), str) else ""
        sentences = [s for s in re.split(r"(?<=[.!?])\s+", summary.strip()) if s]
        checks.append(("summary is 1 sentence", len(sentences) == 1, f"{len(sentences)} sentences: {summary!r}"))
        summary_words = len(summary.split())
        checks.append(("summary<=30 words", 0 < summary_words <= 30, f"{summary_words} words"))
        opener = next((o for o in DESCRIBING_OPENERS if summary.lower().startswith(o)), None)
        checks.append(("summary says what, not 'the speaker'", opener is None, f"starts with {opener!r}" if opener else ""))

    if mode == "conversation":
        # A readable account, not the turns copied out as a script.
        # Like LLMCopywriterService.isReport: "Name:" lines mean the turns were copied back.
        report = obj.get("report") if isinstance(obj.get("report"), str) else ""
        script = re.findall(r"(?:^|[.!?\"'\n]\s*)[A-Z][\w.' ]{0,24}:\s", report)
        checks.append(("prose, not a script", len(script) < 2, f"{len(script)} 'Name:' lines"))

    text = "\n".join(strings_in(obj))
    body = "\n".join(s for k, v in obj.items() if k not in ("title", "tags") for s in strings_in(v))
    leaked = [m for m in LEAK_MARKERS if m.lower() in text.lower()]
    checks.append(("no prompt leak", not leaked, f"leaked {leaked}" if leaked else ""))

    if mode == "full" and source is not None:
        written = "\n".join(strings_in(obj.get("summary")) + [s for k in field_keys for s in strings_in(obj.get(k))])
        share = grounded_share(written, source)
        checks.append(("grounded in the memo", share is None or share >= MIN_GROUNDED_SHARE,
                       "too little to judge" if share is None else f"{share:.0%} of its words"))
    if expect.get("language") == "cjk":
        share = cjk_share(body)
        checks.append(("same language (CJK)", share >= 0.6, f"{share:.0%} CJK letters"))

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
