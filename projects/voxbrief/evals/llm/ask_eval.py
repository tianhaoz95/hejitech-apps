"""Ask Voxbrief tool-use eval: does the model call search_notes and answer from what it finds?

Mirrors `AskConversation` (VoxbriefApp/Services/AskService.swift): the same system prompt and
tool spec, Qwen3's native tool format, the Lite rule (each question's first reply is started as
a search call) and Flash's retry (an answer before any search is redone as a search), and at
most four model calls a question. Keep the prompt and tool text in step with the Swift file.
The notes and search are a small stand-in for `NoteSearchIndex`; what's measured is the
model's tool use and answers, scored by expected words.

    python ask_eval.py <model dir or mlx-community repo>
"""
import json, re, sys, datetime as dt
from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler

MODEL = sys.argv[1] if len(sys.argv) > 1 else "../../VoxbriefApp/Resources/Models/Qwen3-0.6B-4bit"
LITE = "0.6B" in MODEL
THINK = False
TODAY = dt.date(2026, 11, 19)

NOTES = [
    ("Budget sync with Priya", 1, "We agreed the Q1 marketing budget is 42,000 dollars. Priya will send the revised spreadsheet by Wednesday. Ads spend goes down to 15 percent."),
    ("Dentist reminder", 2, "Call Dr. Lee's office on Monday to move the cleaning appointment to December 3rd at 9am."),
    ("Ideas for the garden", 5, "Plant garlic before the first frost, move the blueberry bushes to the sunny side, and buy two bags of mulch."),
    ("Standup notes", 0, "Tom finished the login screen. Maya is blocked on the API keys from the vendor. I need to review Tom's pull request today."),
    ("Trip to Lisbon", 9, "Flights booked for January 14th, returning the 21st. Hotel is in Alfama. Remember to renew the passport before then."),
    ("Book recommendations from Sam", 12, "Sam recommended Piranesi and The Remains of the Day. He said Piranesi is short and strange in a good way."),
    ("Car maintenance", 20, "Oil change is due at 45,000 miles; the tires should be rotated at the same time. The shop on Pine Street quoted 89 dollars."),
]

STOP = {"this","that","week","last","what","did","record","recorded","the","and","notes","note","anything","about"}
def search(query, days_back=None):
    res = _search(query, days_back)
    if res is None and days_back is not None:
        older = _search(query, None)
        if older: return f"Nothing in the last {days_back} days. Older notes:\n" + older
    return res or "No notes matched."

def _search(query, days_back=None):
    q = [w for w in re.findall(r"[a-z0-9]+", (query or "").lower()) if len(w) > 2 and w not in STOP]
    q = [w[:-1] if w.endswith("s") and len(w) > 3 else w for w in q]  # plurals, as the index stems
    scored = []
    for i, (title, ago, text) in enumerate(NOTES):
        if days_back is not None and ago > days_back:
            continue
        hay = (title + " " + text).lower()
        score = sum(hay.count(w) for w in q) if q else 1.0 / (1 + ago)
        if score > 0:
            scored.append((score, -ago, i))
    scored.sort(reverse=True)
    out = []
    for n, (_, _, i) in enumerate(scored[:4], 1):
        title, ago, text = NOTES[i]
        date = (TODAY - dt.timedelta(days=ago)).strftime("%b %d")
        out.append(f'[{n}] "{title}" ({date}): {text}')
    return "\n".join(out) if out else None

TOOLS = [{
    "type": "function",
    "function": {
        "name": "search_notes",
        "description": "Search the user's voice notes by keywords. Returns numbered passages, each with its note's title and date. An empty query returns the most recent notes.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Keywords to look for, with a few synonyms (for \"money\": budget, cost, price)."},
                "days_back": {"type": "integer", "description": "Only when the question names a time (\"this week\": 7, \"yesterday\": 1). Leave it out otherwise."},
            },
            "required": ["query"],
        },
    },
}]

SYSTEM = (
    f"You are Voxbrief's assistant. You answer questions about the user's own voice notes. "
    f"Today is {TODAY:%A, %B %d, %Y}. You can't see the notes. For every new question, your first reply "
    "must be a search_notes call; answer only after you've read its results, and search again "
    "with other words if they don't answer it. Then answer in one to four sentences, speaking "
    "to the user as \"you\", with specifics (names, dates, amounts) from the passages, and cite "
    "the passages you used like [2]. If the passages don't answer it, say you couldn't find it "
    "in the notes."
)


model, tok = load(MODEL)
sampler = make_sampler(temp=0.3)
PRE = '<tool_call>\n{"name": "search_notes", "arguments": '
calls_made = 0

def gen(msgs, tools, prefix):
    p = tok.apply_chat_template(msgs, tools=tools, add_generation_prompt=True, enable_thinking=False, tokenize=False) + prefix
    return prefix + generate(model, tok, prompt=p, max_tokens=400, sampler=sampler, verbose=False)

def call_in(out):
    m = re.search(r"<tool_call>\s*(\{[\s\S]*\})", out)
    if not m: return None
    txt = m.group(1).split("</tool_call>")[0]
    try:
        obj = json.loads(txt)
    except Exception:
        try: obj = json.loads(txt[:txt.rfind("}")+1])
        except Exception: return None
    a = obj.get("arguments", obj)
    d = a.get("days_back") or a.get("days")
    return a.get("query", ""), (d if isinstance(d, int) and d > 0 else None)

def run(history, question, have_passages):
    turn = [{"role": "user", "content": question}]
    searched = False; trace = []
    for step in range(4):
        last = step == 3
        msgs = [{"role": "system", "content": SYSTEM}] + history + turn
        pre = PRE if (not searched and step == 0 and LITE) else ""
        tools = [] if last else TOOLS
        out = gen(msgs, tools or None, pre)
        if not last and not searched and not have_passages and call_in(out) is None and not pre:
            trace.append(("retry", out[:80])); out = gen(msgs, TOOLS, PRE)
        c = None if last else call_in(out)
        if c:
            q, d = c
            res = search(q, d)
            trace.append(("call", f"{q!r} days={d}"))
            turn += [{"role": "assistant", "content": out}, {"role": "tool", "content": res}]
            searched = True; have_passages = True
            continue
        out = re.sub(r"<tool_call>[\s\S]*", "", out).strip()
        trace.append(("answer", out))
        turn.append({"role": "assistant", "content": out})
        return out, trace, history + turn, have_passages
    return "", trace, history + turn, have_passages

CONVOS = [
    (["How much is the marketing budget?", "Who is sending the spreadsheet?"], [["42,000", "42000"], ["priya"]]),
    (["When is my dentist appointment?"], [["december 3", "dec 3", "3rd"]]),
    (["What did I record this week?"], [["standup", "budget", "dentist", "garden"]]),
    (["What books did Sam recommend?", "Which one is short?"], [["piranesi"], ["piranesi"]]),
    (["When do I fly to Lisbon?", "Anything I need to do before?"], [["january 14", "jan 14", "14th"], ["passport"]]),
    (["What's blocking Maya?"], [["api key"]]),
    (["Did I note anything about a dog?"], [["couldn't", "no ", "not "]]),
    (["How much did the shop quote for the oil change?"], [["89"]]),
    (["What should I plant before the frost?"], [["garlic"]]),
    (["What do I need to review today?"], [["pull request", "tom"]]),
]
ok = searched_turns = total = 0
for convo, expects in CONVOS:
    history = []; have = False
    for q, exp in zip(convo, expects):
        total += 1
        ans, trace, history, have = run(history, q, have)
        hit = any(e in ans.lower() for e in exp)
        ok += hit
        if any(t[0] == "call" for t in trace): searched_turns += 1
        print(("PASS" if hit else "FAIL"), "Q:", q)
        for k, t in trace: print(f"     {k}: {t[:220]}")
print(f"\n{MODEL.split('/')[-1]}: correct {ok}/{total}, searched in {searched_turns}/{total} turns")
