"""Ask Voxbrief tool-use eval: does the model call its tools and answer from what it finds?

Mirrors `AskConversation` (VoxbriefApp/Services/AskService.swift): the same system prompts and
tool specs, Qwen3's native tool format, the Lite rule (search_notes alone; each question's first
reply is started as a search call), Flash's three tools (search_notes, notes_on_dates,
open_todos) and its retry (an answer before any tool call is redone as a search), and at most
four model calls a question. Keep the prompt and tool text in step with the Swift file.
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

# Open to-dos per note title (what open_todos reads), the rest of each note's items checked off.
TODOS = {
    "Budget sync with Priya": ["Check Priya's revised spreadsheet"],
    "Dentist reminder": ["Call Dr. Lee's office to move the cleaning"],
    "Standup notes": ["Review Tom's pull request"],
    "Trip to Lisbon": ["Renew the passport"],
}

import os
FORMAT = os.environ.get("ASK_FORMAT", "C")
def passage(n, title, date, section, text):
    if FORMAT == "B": return f"[{n}] {text}\n    (from your note \"{title}\", {date})"
    if FORMAT == "C": return f"Passage {n}, from \"{title}\" ({date}):\n{text}"
    return f'[{n}] Note "{title}" ({date}, {section}): {text}'

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
        out.append(passage(n, title, date, "transcript", text))
    return "\n".join(out) if out else None

def notes_on_dates(frm, to=None):
    try:
        a = dt.date.fromisoformat(frm.strip()); b = dt.date.fromisoformat((to or frm).strip())
    except Exception:
        return f'"{frm}" isn\'t a date. Pass days as YYYY-MM-DD.'
    if b < a: b = a
    rows = sorted([(TODAY - dt.timedelta(days=ago), t, x) for t, ago, x in NOTES if a <= TODAY - dt.timedelta(days=ago) <= b])
    if not rows: return f"No notes were recorded {'on' if a == b else 'between'} {frm}{'' if a == b else ' to ' + (to or frm)}."
    return "\n".join(passage(n, t, d.strftime("%b %d"), "overview", x) for n, (d, t, x) in enumerate(rows, 1))

def open_todos(days_back=None):
    rows = [(ago, t) for t, ago, _ in NOTES if t in TODOS and (days_back is None or ago <= days_back)]
    rows.sort()
    if not rows: return "No open to-dos."
    return "\n".join(passage(n, t, (TODAY - dt.timedelta(days=ago)).strftime("%b %d"), "to-dos", "Open to-dos:\n" + "\n".join("- " + i for i in TODOS[t])) for n, (ago, t) in enumerate(rows, 1))

TOOLS = [{
    "type": "function",
    "function": {
        "name": "search_notes",
        "description": "Search the user's voice notes by keywords. Returns numbered passages, each with its note's title and date. An empty query returns the most recent notes.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Words from the question to look for, plus a few synonyms."},
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
    "the passages you used like [2]. Answer in your own words: never copy a passage or its "
    "\"Note ... :\" heading. If the passages don't answer it, say you couldn't find it in the notes."
)

TOOLS_ALL = TOOLS + [{
    "type": "function",
    "function": {
        "name": "notes_on_dates",
        "description": "List the notes recorded on a day or between two days, each with its summary. Use it when the question is about when (\"what did I record on Monday\", \"my notes from last week\") rather than a topic.",
        "parameters": {
            "type": "object",
            "properties": {
                "from": {"type": "string", "description": "The first day, as YYYY-MM-DD."},
                "to": {"type": "string", "description": "The last day, as YYYY-MM-DD. Leave it out for a single day."},
            },
            "required": ["from"],
        },
    },
}, {
    "type": "function",
    "function": {
        "name": "open_todos",
        "description": "List the to-dos from the notes that aren't checked off yet, newest note first. Use it for questions about tasks, to-dos or what's left to do.",
        "parameters": {
            "type": "object",
            "properties": {
                "days_back": {"type": "integer", "description": "Only to-dos from notes of the last N days. Leave it out for all."},
            },
        },
    },
}]

SYSTEM_ALL = (
    f"You are Voxbrief's assistant. You answer questions about the user's own voice notes. "
    f"Today is {TODAY:%A, %B %d, %Y} ({TODAY.isoformat()}). You can't see the notes. For every new question, your first "
    "reply must be a tool call: notes_on_dates when the question is about a day or a period "
    "(work out the dates from today), open_todos when it's about tasks or what's left to do, "
    "search_notes for anything else. Answer only after you've read the results, and look "
    "again another way if they don't answer it. Then answer in one to four sentences, speaking "
    "to the user as \"you\", with specifics (names, dates, amounts) from the passages, and cite "
    "the passages you used like [2]. Answer in your own words: never copy a passage or its "
    "heading. If the passages don't answer it, say you couldn't find it in the notes."
)

ROUTER = (
    "Label the message CHAT or NOTES. CHAT: greetings, thanks, small talk, questions about the "
    "assistant. NOTES: asks about the user's own recordings, plans, people, tasks, numbers or topics.\n"
    "Examples:\nhey there -> CHAT\nthanks a lot -> CHAT\nwhat are you? -> CHAT\n"
    "when is the team offsite? -> NOTES\nwhat did Alex say about pricing -> NOTES\ngroceries -> NOTES\n"
    "Reply with the label only."
)
CHAT = (
    "You are Voxbrief's assistant: you find things in the user's own voice notes and answer "
    "questions about them. Reply to this message in one or two short, friendly sentences. "
    "Don't make up anything about their notes."
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
    if isinstance(a, str):
        try: a = json.loads(a)
        except Exception: a = {}
    d = a.get("days_back") or a.get("days")
    if isinstance(d, str) and d.isdigit(): d = int(d)
    d = d if isinstance(d, int) and d > 0 else None
    name = obj.get("name", "search_notes")
    if name == "notes_on_dates": return name, (a.get("from") or a.get("date") or "", a.get("to"))
    if name == "open_todos": return name, (d,)
    return "search_notes", (a.get("query", ""), d)

def run_tool(c):
    name, args = c
    if name == "notes_on_dates": return notes_on_dates(*args)
    if name == "open_todos": return open_todos(*args)
    return search(*args)

def is_chat(question):
    msgs = [{"role": "system", "content": ROUTER}, {"role": "user", "content": question}]
    p = tok.apply_chat_template(msgs, add_generation_prompt=True, enable_thinking=False, tokenize=False)
    return generate(model, tok, prompt=p, max_tokens=4, sampler=make_sampler(temp=0.0), verbose=False).strip().upper().startswith("CHAT")

def run(history, question, have_passages):
    turn = [{"role": "user", "content": question}]
    if LITE and is_chat(question):
        out = gen([{"role": "system", "content": CHAT}] + [m for m in history if m["role"] in ("user", "assistant") and "<tool_call>" not in m["content"]] + turn, None, "")
        out = re.sub(r"<think>[\s\S]*?</think>", "", out).strip()
        return out, [("chat", out)], history + turn + [{"role": "assistant", "content": out}], have_passages
    searched = False; trace = []
    for step in range(4):
        last = step == 3
        msgs = [{"role": "system", "content": SYSTEM if LITE else SYSTEM_ALL}] + history + turn
        pre = PRE if (not searched and step == 0 and LITE) else ""
        tools = [] if last else (TOOLS if LITE else TOOLS_ALL)
        out = gen(msgs, tools or None, pre)
        if not last and not searched and not have_passages and call_in(out) is None and not pre:
            if is_chat(question):
                out = re.sub(r"<think>[\s\S]*?</think>", "", out).strip()
                trace.append(("chat", out))
                turn.append({"role": "assistant", "content": out})
                return out, trace, history + turn, have_passages
            trace.append(("retry", out[:80])); out = gen(msgs, TOOLS if LITE else TOOLS_ALL, PRE)
        c = None if last else call_in(out)
        if c:
            res = run_tool(c)
            trace.append(("call", f"{c[0]} {c[1]!r}"))
            turn += [{"role": "assistant", "content": out}, {"role": "tool", "content": res}]
            searched = True; have_passages = True
            continue
        out = re.sub(r"<tool_call>[\s\S]*", "", out).strip()
        trace.append(("answer", out))
        turn.append({"role": "assistant", "content": out})
        return out, trace, history + turn, have_passages
    return "", trace, history + turn, have_passages

CONVOS = [
    (["Hi", "How much is the marketing budget?", "Thanks!"], [["!"], ["42,000", "42000"], ["!", "welcome", "glad"]]),
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
    # Dates and to-dos (Flash's notes_on_dates and open_todos; Lite answers them by searching).
    (["What did I record yesterday?"], [["budget", "priya", "42"]]),
    (["What did I record on November 14?"], [["garden", "garlic", "mulch"]]),
    (["What's left on my to-do list?"], [["passport", "pull request", "dr. lee", "spreadsheet"]]),
    (["Any open tasks from the last two days?"], [["pull request", "spreadsheet", "dr. lee", "budget"]]),
]
TOOLS_USED = {}
ok = searched_turns = chat_turns = total = 0
for convo, expects in CONVOS:
    history = []; have = False
    for q, exp in zip(convo, expects):
        total += 1
        ans, trace, history, have = run(history, q, have)
        copied = bool(re.search(r'note "|\(from your note|passage \d+, from', ans.lower()))
        hit = any(e in ans.lower() for e in exp) and not copied
        ok += hit
        if any(t[0] == "call" for t in trace): searched_turns += 1
        for k, t in trace:
            if k == "call": TOOLS_USED[t.split(" ")[0]] = TOOLS_USED.get(t.split(" ")[0], 0) + 1
        if any(t[0] == "chat" for t in trace): chat_turns += 1
        print(("PASS" if hit else "FAIL"), "Q:", q)
        for k, t in trace: print(f"     {k}: {t[:220]}")
print(f"\n{MODEL.split('/')[-1]}: correct {ok}/{total}, tools in {searched_turns}/{total} turns, chat in {chat_turns}, calls {TOOLS_USED}")
